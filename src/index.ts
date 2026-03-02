#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://checkpj.app";
const API_KEY = process.env.CHECKPJ_API_KEY;

function stripCnpj(cnpj: string): string {
  return cnpj.replace(/[\.\-\/]/g, "");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "checkpj-mcp/1.0.0",
  };
  if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }
  return headers;
}

async function apiFetch(path: string): Promise<any> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "checkpj",
  version: "1.0.0",
});

// Tool 1: lookup_company
server.tool(
  "lookup_company",
  "Look up a Brazilian company by CNPJ. Returns full company data including name, status, address, CNAE codes, share capital, and more. Data is in Portuguese.",
  { cnpj: z.string().describe("CNPJ number (14 digits, with or without formatting)") },
  async ({ cnpj }) => {
    try {
      const data = await apiFetch(`/v1/cnpj/${stripCnpj(cnpj)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 2: search_companies
server.tool(
  "search_companies",
  "Search for Brazilian companies by name, CNAE code, state (UF), or municipality. Returns an array of matching companies. Data is in Portuguese.",
  {
    query: z.string().optional().describe("General search query"),
    name: z.string().optional().describe("Company name to search for"),
    cnae: z.string().optional().describe("CNAE code to filter by"),
    uf: z.string().optional().describe("State abbreviation (e.g. SP, RJ, MG)"),
    municipio: z.string().optional().describe("Municipality name"),
    limit: z.number().optional().describe("Maximum number of results (default: 10)"),
  },
  async (params) => {
    try {
      const searchParams = new URLSearchParams();
      if (params.query) searchParams.set("q", params.query);
      if (params.name) searchParams.set("name", params.name);
      if (params.cnae) searchParams.set("cnae", params.cnae);
      if (params.uf) searchParams.set("uf", params.uf);
      if (params.municipio) searchParams.set("municipio", params.municipio);
      if (params.limit) searchParams.set("limit", String(params.limit));
      const qs = searchParams.toString();
      const data = await apiFetch(`/v1/search${qs ? `?${qs}` : ""}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 3: get_health_score
server.tool(
  "get_health_score",
  "Get a company's health score by CNPJ. Returns a score (0-100), grade (A-E), risk level, survival probability, and contributing factors. Data is in Portuguese.",
  { cnpj: z.string().describe("CNPJ number (14 digits, with or without formatting)") },
  async ({ cnpj }) => {
    try {
      const data = await apiFetch(`/v1/health/${stripCnpj(cnpj)}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err: any) {
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 4: validate_cnpj
server.tool(
  "validate_cnpj",
  "Validate a CNPJ number and check if the company is active. Returns validity, active status, registration status, and company name.",
  { cnpj: z.string().describe("CNPJ number (14 digits, with or without formatting)") },
  async ({ cnpj }) => {
    try {
      const cleaned = stripCnpj(cnpj);
      if (cleaned.length !== 14 || !/^\d{14}$/.test(cleaned)) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ valid: false, active: false, status: "invalid_format", company_name: null }),
          }],
        };
      }
      const data = await apiFetch(`/v1/cnpj/${cleaned}`);
      const status = data.situacao_cadastral || data.status || "unknown";
      const active = typeof status === "string"
        ? status.toLowerCase().includes("ativ")
        : status === 2 || status === "02";
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            valid: true,
            active,
            status,
            company_name: data.razao_social || data.nome || data.company_name || null,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      if (err.message.includes("404") || err.message.includes("not found")) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ valid: false, active: false, status: "not_found", company_name: null }),
          }],
        };
      }
      return { content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CheckPJ MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
