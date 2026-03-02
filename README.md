# checkpj-mcp-server

MCP server for [CheckPJ](https://checkpj.app) — Brazilian company data API.

Exposes 4 tools for Claude and other MCP-compatible AI assistants:

- **lookup_company** — Look up a company by CNPJ
- **search_companies** — Search companies by name, CNAE, state, or municipality
- **get_health_score** — Get a company's health/risk score
- **validate_cnpj** — Check if a CNPJ is valid and active

## Setup

### Claude Code

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "checkpj": {
      "command": "node",
      "args": ["/path/to/checkpj-mcp/dist/index.js"],
      "env": {
        "CHECKPJ_API_KEY": "your-api-key"
      }
    }
  }
}
```

### npm (global install)

```bash
npm install -g checkpj-mcp-server
```

Then use `checkpj-mcp` as the command.

## Configuration

Set `CHECKPJ_API_KEY` environment variable for authenticated access. Without it, the free tier (limited requests) is used.

## Development

```bash
bun install
bun build src/index.ts --outdir dist --target node
node dist/index.js
```
