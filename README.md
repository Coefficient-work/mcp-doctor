# mcp-doctor

**Agent-facing API QA** — prove agents can actually use your MCP before you ship.

> *"We prove agents can actually use your MCP."*

Free CLI scorecard + token analysis. No API key required.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why

API teams ship MCP servers from OpenAPI (Stainless, Speakeasy, Postman). Agents still fail — wrong tools, schema drift, token bloat, missing auth clarity. **mcp-doctor** scores agent readiness and tracks the competitive landscape.

## Try in 2 minutes

### 1. Run the agent-readiness scorecard

```bash
npx github:louisreid/mcp-doctor test --demo
```

Checks: tool count, token footprint, descriptions, destructive ops, auth clarity, schema complexity, security smells.

### 2. Analyze token optimization (from mcp-slim)

```bash
npx github:louisreid/mcp-doctor analyze --demo
```

### 3. Your own OpenAPI spec

```bash
npx github:louisreid/mcp-doctor test ./openapi.json
npx github:louisreid/mcp-doctor analyze ./openapi.json
```

### 4. Competitor map

```bash
npx github:louisreid/mcp-doctor competitors
npx github:louisreid/mcp-doctor competitors --category testing
```

Tracks 30+ players from ChatGPT market research + Coefficient desk analysis. See [`docs/competitors/`](docs/competitors/README.md).

### 5. Demo MCP server in Cursor

```bash
npx github:louisreid/mcp-doctor init
```

Paste into **Cursor ? Settings ? MCP**, restart, ask: *What MCP tools do you have?*

## Commands

| Command | Description |
|---------|-------------|
| `test [spec]` | **Agent-readiness scorecard** (grade A–F) |
| `analyze [spec]` | Token footprint + optimization report |
| `competitors` | Competitor map (standards, generation, gateway, testing) |
| `build [spec]` | Optimized tools + Cursor config |
| `serve [spec]` | Demo stdio MCP server |
| `init` | Cursor MCP config snippet |

## Roadmap (ChatGPT wedge)

| Week | Feature | Status |
|------|---------|--------|
| 1 | Static scorecard CLI | **v0.2** |
| 2 | OpenAPI ? MCP drift detector | Planned |
| 3 | Agent eval runner (BYOK) | Planned |
| 4 | GitHub Action + PR scorecard | Planned |
| Launch | "State of MCP Agent Readiness" benchmark | Planned |

## Pricing direction

| Tier | Offer |
|------|-------|
| OSS CLI | Free — scorecard + competitor map |
| Audit | £2k fixed agent-readiness report |
| CI | £500–2k/mo regression monitoring |

## Develop locally

```bash
git clone https://github.com/louisreid/mcp-doctor.git
cd mcp-doctor
pnpm install
pnpm build
node dist/cli.js test --demo
pnpm test
```

## Renamed from mcp-slim

v0.1 shipped as **mcp-slim** (token optimization, A3 hypothesis). v0.2 pivots to **mcp-doctor** (D1 + eval wedge per ChatGPT research). Token analysis remains via `analyze`.

## Feedback

Issues and PRs: [github.com/louisreid/mcp-doctor](https://github.com/louisreid/mcp-doctor)

Part of [Coefficient](https://github.com/louisreid/coefficient) investigation.

## License

MIT
