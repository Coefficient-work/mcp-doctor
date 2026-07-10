# mcp-doctor — Agent Readiness Platform (MCP wedge)

**Agent-facing API QA** — score, inspect, evaluate, and improve MCP quality.

> *"We prove agents can actually use your MCP."*

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Real benchmark results

**[State of MCP Quality 2026 (v0)](examples/reports/STATE-OF-MCP-2026.md)** — 10 public servers scored live:

| Server | Grade | Tools | Tokens |
|--------|-------|-------|--------|
| MCP Filesystem | A | 14 | 1,997 |
| MCP Sequential Thinking | A | 1 | 996 |
| MCP Everything | A | 13 | 1,236 |
| MCP Memory | A | 9 | 1,040 |
| MCP Puppeteer | B | 7 | 612 |

Per-server reports: [`examples/reports/`](examples/reports/)

```bash
npx github:louisreid/mcp-doctor benchmark -o ./reports
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
npx github:louisreid/mcp-doctor benchmark

# Inspect your Cursor MCP server
npx github:louisreid/mcp-doctor list
npx github:louisreid/mcp-doctor inspect <name> -o report.md

# Agent eval (BYOK — your OpenAI key, local only)
export OPENAI_API_KEY=sk-...
npx github:louisreid/mcp-doctor eval memory \
  --task "List all tools and describe them" \
  --models gpt-4o-mini,gpt-4o -o eval-report.md
```

## Pain Interview (before sending to friends)

See [`docs/FRIEND-GUIDE.md`](docs/FRIEND-GUIDE.md) and Coefficient [`PAIN-INTERVIEW.md`](https://github.com/louisreid/coefficient/blob/main/research/design-partners/PAIN-INTERVIEW.md).

**Do not** ask friends to beta-test until you've run a 30-min workflow interview.

## Commands

| Command | Description |
|---------|-------------|
| `benchmark` | State of MCP Quality — score catalog servers |
| `list` | MCP servers in `~/.cursor/mcp.json` |
| `inspect <name>` | Live connect + scorecard + suggested fixes |
| `eval <name> --task "..."` | BYOK agent eval + friction + replay |
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

MIT — [Coefficient](https://github.com/louisreid/coefficient) investigation
