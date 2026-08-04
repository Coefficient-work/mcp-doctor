# mcp-doctor ? Agent Readiness Platform (MCP wedge)

**The easiest way to score MCP agent readiness.**

Open-source CLI � inspect, benchmark, and eval MCP servers before agents hit production.

> *"We prove agents can actually use your MCP."*

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Site](https://img.shields.io/badge/site-coefficient.work-black)](https://coefficient.work)

## Real benchmark results

**[State of MCP Quality 2026 (v0)](examples/reports/STATE-OF-MCP-2026.md)** ? 10 public servers scored live:

| Server | Grade | Tools | Tokens |
|--------|-------|-------|--------|
| MCP Filesystem | A | 14 | 1,997 |
| MCP Sequential Thinking | A | 1 | 996 |
| MCP Everything | A | 13 | 1,236 |
| MCP Memory | A | 9 | 1,040 |
| MCP Puppeteer | B | 7 | 612 |

Per-server reports: [`examples/reports/`](examples/reports/)

```bash
npx github:coefficient-ai/mcp-doctor benchmark -o ./reports
```

## Three pillars

| Pillar | Command | Status |
|--------|---------|--------|
| **Static scorecard** | `inspect`, `test` | v0.4 |
| **Task success** | `eval` (BYOK) | v0.4 |
| **Agent friction** | included in `eval` | v0.4 |

Plus: **Recommended Improvements**, **Replay Timeline**, **Model Compatibility Matrix** (multi-model eval).

## Quick start

```bash
# Benchmark public MCPs
npx github:coefficient-ai/mcp-doctor benchmark

# Inspect your Cursor MCP server
npx github:coefficient-ai/mcp-doctor list
npx github:coefficient-ai/mcp-doctor inspect <name> -o report.md

# Agent eval (BYOK � Vercel AI Gateway free trial, local only)
export AI_GATEWAY_API_KEY=...
npx github:coefficient-ai/mcp-doctor eval memory \
  --task "List all tools and describe them" \
  --models openai/gpt-4o-mini,openai/gpt-4o -o eval-report.md
```

### AI Gateway setup (one-time)

```bash
vercel login
cd mcp-doctor && vercel link
vercel ai-gateway api-keys create --name mcp-doctor-local --budget 5 --refresh-period monthly
# Key saved to .env.local (gitignored) � CLI auto-loads it for eval
```

## Pain Interview (before sending to friends)

See [`docs/FRIEND-GUIDE.md`](docs/FRIEND-GUIDE.md) and Coefficient [`PAIN-INTERVIEW.md`](https://github.com/coefficient-ai/coefficient/blob/main/research/design-partners/PAIN-INTERVIEW.md).

**Do not** ask friends to beta-test until you've run a 30-min workflow interview.

## Commands

| Command | Description |
|---------|-------------|
| `benchmark` | State of MCP Quality ? score catalog servers |
| `list` | MCP servers in `~/.cursor/mcp.json` |
| `inspect <name>` | Live connect + scorecard + suggested fixes |
| `eval <name> --task "..."` | BYOK agent eval + friction + replay (Vercel AI Gateway) |
| `test --demo` | Static scorecard on OpenAPI fixture |
| `competitors` | 36-player market map |

## Roadmap

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | Public benchmark reports | **v0.4** |
| 2 | Pain Interview (Jonty / Anders) | In progress |
| 3 | BYOK eval + friction | **v0.4** |
| 4 | Suggested fixes | **v0.4** |
| 5 | Model matrix | **v0.4** |
| 6 | Scale to 50 MCPs + awards | Next |
| 9 | OpenAPI drift | Deprioritized |

## License

MIT ? [Coefficient](https://github.com/coefficient-ai/coefficient) investigation
