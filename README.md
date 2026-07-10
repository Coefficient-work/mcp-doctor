# mcp-doctor

**Agent-facing API QA** — prove agents can actually use your MCP before you ship.

> *"We prove agents can actually use your MCP."*

Free CLI: **live MCP inspection** + scorecard + token analysis.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## For friends evaluating their company's MCP (e.g. Vooma)

**5-minute eval** — full guide: [`docs/FRIEND-GUIDE.md`](docs/FRIEND-GUIDE.md)

```bash
# 1. See MCP servers in your Cursor config
npx github:louisreid/mcp-doctor list

# 2. Inspect live server (replace `vooma` with your server name)
npx github:louisreid/mcp-doctor inspect vooma -o report.md

# 3. Send report.md back with the feedback section filled in
```

Direct URL (no Cursor config):

```bash
npx github:louisreid/mcp-doctor inspect --url https://your-mcp-host/mcp \
  -H "Authorization:Bearer TOKEN" -o report.md
```

## Why

API teams ship MCP servers from OpenAPI (Stainless, Speakeasy, Postman). Agents still fail — wrong tools, schema drift, token bloat. **mcp-doctor** connects to your **real** MCP, lists tools, and scores agent readiness.

## Commands

| Command | Description |
|---------|-------------|
| `list` | MCP servers in `~/.cursor/mcp.json` |
| `inspect <name>` | **Live MCP** connect + scorecard |
| `inspect --url <url>` | Remote MCP with optional `-H` headers |
| `test [spec]` | Static scorecard from OpenAPI |
| `analyze [spec]` | Token footprint report |
| `competitors` | 36-player market map |

## Demo (no company MCP needed)

```bash
npx github:louisreid/mcp-doctor test --demo
npx github:louisreid/mcp-doctor init   # paste into Cursor MCP settings
```

## Roadmap

| Week | Feature | Status |
|------|---------|--------|
| 1 | Static scorecard | Done |
| 1b | **Live MCP inspect** | **v0.3** |
| 2 | OpenAPI ? MCP drift | Next |
| 3 | Agent eval runner (BYOK) | Planned |
| 4 | GitHub Action + PR scorecard | Planned |

## Develop

```bash
git clone https://github.com/louisreid/mcp-doctor.git
cd mcp-doctor && pnpm install && pnpm build && pnpm test
```

## License

MIT — [Coefficient](https://github.com/louisreid/coefficient) investigation
