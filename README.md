# MCP Doctor by Coefficient

**Know whether agents can use your MCP before you ship.**

Open-source CLI that inspects schemas, runs task evals, and writes a local readiness report.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Site](https://img.shields.io/badge/site-coefficient.work-black)](https://coefficient.work)

Public GitHub/npm identity is `coefficient-work`. That organization may not exist yet, so repository and package links can 404 until it is created. Do not install the unrelated unscoped `mcp-doctor` package.

```bash
npx @coefficient-work/mcp-doctor@latest inspect memory -o report.md
```

Telemetry ingestion is off. `mcp-doctor telemetry status|enable|disable` and `--no-telemetry` are implemented; no usage events are sent until the legal operator is verified.

## Real benchmark results

**[State of MCP Quality 2026 (v0)](examples/reports/STATE-OF-MCP-2026.md)** — 10 public servers scored live on 2026-07-10, CLI v0.4.1:

| Server | Grade | Tools | Tokens |
|--------|-------|-------|--------|
| MCP Filesystem | A | 14 | 1,997 |
| MCP Sequential Thinking | A | 1 | 996 |
| MCP Everything | A | 13 | 1,236 |
| MCP Memory | A | 9 | 1,040 |
| MCP Puppeteer | B | 7 | 612 |

Per-server reports: [`examples/reports/`](examples/reports/)

```bash
npx @coefficient-work/mcp-doctor@latest benchmark -o ./reports
```

## Quick start

```bash
npx @coefficient-work/mcp-doctor@latest list
npx @coefficient-work/mcp-doctor@latest inspect <name> -o report.md

# Agent eval (BYOK — Vercel AI Gateway, local only)
export AI_GATEWAY_API_KEY=...
npx @coefficient-work/mcp-doctor@latest eval memory \
  --task "List all tools and describe them" \
  --models openai/gpt-4o-mini,openai/gpt-4o -o eval-report.md
```

## Commands

| Command | Description |
|---------|-------------|
| `benchmark` | State of MCP Quality — score catalog servers |
| `list` | MCP servers in `~/.cursor/mcp.json` |
| `inspect <name>` | Live connect + scorecard + suggested fixes |
| `eval <name> --task "..."` | BYOK agent eval + friction + replay |
| `telemetry status\|enable\|disable` | Local preference only; ingestion is off |
| `test --demo` | Static scorecard on OpenAPI fixture |
| `competitors` | Market map |

## License

MIT. MCP Doctor by Coefficient is an early-stage open-source project.
