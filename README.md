# MCP Doctor

**The easiest way to score MCP agent readiness.**

Open-source CLI — inspect, benchmark, and eval MCP servers before agents hit production.

> *"Prove that models can execute your MCP, then see where schemas create friction."*

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Site](https://img.shields.io/badge/site-coefficient.work-black)](https://coefficient.work)

## Real benchmark results

**[State of MCP Quality 2026 (v0)](examples/reports/STATE-OF-MCP-2026.md)** — historical 2026-07-10 snapshot: 10 public servers attempted, 5 connected and scored. It is schema-readiness evidence, not behavioral proof:

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

Public package: `@coefficient-work/mcp-doctor`. Do not install the unrelated unscoped `mcp-doctor` package.

## Three pillars

| Pillar | Command | Status |
|--------|---------|--------|
| **Static scorecard** | `inspect`, `test` | v0.4 |
| **Execution proof** | `eval` (BYOK) | v0.4 |
| **Agent friction** | included in `eval` | v0.4 |

Plus: **Recommended Improvements**, **Replay Timeline**, **Model Compatibility Matrix** (multi-model eval).

## Quick start

```bash
# Benchmark public MCPs
npx @coefficient-work/mcp-doctor@latest benchmark

# Inspect your Cursor MCP server (also reads ./mcp.json)
npx @coefficient-work/mcp-doctor@latest list
npx @coefficient-work/mcp-doctor@latest inspect <name> -o report.md

# Cross-provider agent eval (BYOK — credential values stay local)
export OPENROUTER_API_KEY=...
npx @coefficient-work/mcp-doctor@latest eval memory \
  --task "List all tools and describe them" \
  --models openrouter/openai/gpt-5.6-sol,openrouter/anthropic/claude-sonnet-5,openrouter/google/gemini-3.7-flash \
  -o eval-report.md
```

### Portable eval credentials (macOS/Linux)

For evals that run from temporary sandboxes or on more than one Mac, keep the
same private file at `~/.config/mcp-doctor/evaluation.env` on each machine:

```bash
install -d -m 700 ~/.config/mcp-doctor
install -m 600 examples/evaluation.env.example ~/.config/mcp-doctor/evaluation.env
```

Edit that file and add only the provider keys you use. The CLI never overrides
an already exported environment variable. Without an explicit file, precedence
is `./.env.local` followed by `~/.config/mcp-doctor/evaluation.env`. Select a
different private file with `mcp-doctor eval --env-file /path/to/evaluation.env`
or `MCP_DOCTOR_ENV_FILE`; explicitly selected files must exist and be mode 600.
Only known model-provider variables are loaded, and values are parsed as data —
not executed as shell code.

OpenRouter uses its OpenAI-compatible endpoint through the Vercel AI SDK. Prefix an OpenRouter-routed model with `openrouter/`, followed by the normal OpenRouter model ID:

```bash
export OPENROUTER_API_KEY=...
npx @coefficient-work/mcp-doctor@latest eval memory \
  --task "List all tools and describe them" \
  --models openrouter/openai/gpt-5.6-sol,openrouter/anthropic/claude-sonnet-5,openrouter/google/gemini-3.7-flash \
  -o eval-report.md
```

`eval` proves execution only when at least one MCP tool returns a non-error result. It does not formally prove that an arbitrary natural-language task was semantically completed. Credential values are not stored or printed, but eval necessarily sends the task, tool schemas, calls, and tool results to the selected model provider. `inspect` is local except for connecting to the MCP endpoint; `benchmark` launches or contacts every server in its catalog.

### AI Gateway setup (one-time)

```bash
vercel login
cd mcp-doctor && vercel link
vercel ai-gateway api-keys create --name mcp-doctor-local --budget 5 --refresh-period monthly
# Key saved to .env.local (gitignored) — CLI auto-loads it for eval
```

## Pain Interview (before sending to friends)

See [`docs/FRIEND-GUIDE.md`](docs/FRIEND-GUIDE.md).

**Do not** ask friends to beta-test until you've run a 30-min workflow interview.

## Commands

| Command | Description |
|---------|-------------|
| `benchmark` | State of MCP Quality — score catalog servers (writes files only with `--out`) |
| `list` | MCP servers in `./mcp.json` or `~/.cursor/mcp.json` |
| `inspect <name>` | Live connect + scorecard + suggested fixes (missing `inputSchema` -> Grade F, exit 2) |
| `eval <name> --task "..."` | BYOK execution proof + friction + replay (OpenRouter, OpenAI, Anthropic, Gateway, or Ollama) |
| `test --demo` | Static scorecard on OpenAPI fixture |
| `build --demo --out <dir>` | Write optimized MCP tool bundle (requires `--out`) |
| `competitors` | Adjacent MCP tooling map |

Run `npm run prepublish-gate` before every publish. Run `npm run blind-eval` when you want a no-context agent pass against a packed tarball.

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

MIT
