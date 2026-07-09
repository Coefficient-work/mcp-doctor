# mcp-slim

**Shrink MCP tool menus from OpenAPI** — progressive discovery cuts token bloat so agents see fewer tools upfront.

Free CLI + demo MCP server. No API key required.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why

Large OpenAPI specs become huge MCP tool lists. Bloated menus waste context window and hurt tool-selection accuracy ([StackOne](https://www.stackone.com/blog/mcp-token-optimization/), [a16z MCP deep dive](https://a16z.com/a-deep-dive-into-mcp-and-the-future-of-ai-tooling/)).

**mcp-slim** groups operations by tag (progressive discovery), trims schemas, and reports token savings.

## Try in 2 minutes (friend-friendly)

### 1. Analyze the demo API

```bash
npx github:louisreid/mcp-slim analyze --demo
```

Expected: ~**60% fewer tokens**, 24 operations ? 6 discovery tools.

### 2. Analyze your own OpenAPI spec

```bash
npx github:louisreid/mcp-slim analyze ./openapi.json
# or a URL:
npx github:louisreid/mcp-slim analyze https://example.com/openapi.json
```

### 3. Run the demo MCP server in Cursor

Print config:

```bash
npx github:louisreid/mcp-slim init
```

Paste the JSON into **Cursor ? Settings ? MCP** (merge under `mcpServers`), restart Cursor, then ask:

> What MCP tools do you have?

You should see **6 discovery tools** (users, billing, projects, …) instead of 24 flat operations.

**Claude Desktop** — same JSON under `~/Library/Application Support/Claude/claude_desktop_config.json`.

### 4. Build a bundle for sharing

```bash
npx github:louisreid/mcp-slim build ./openapi.json -o ./my-mcp
```

Outputs `tools.json`, `cursor-mcp.json`, and `TRY-IN-CURSOR.md`.

## Commands

| Command | Description |
|---------|-------------|
| `analyze [spec]` | Token report (default: bundled demo API) |
| `build [spec]` | Write optimized tools + Cursor config |
| `serve [spec]` | Stdio MCP server (**demo mode** — simulated responses) |
| `init` | Print Cursor MCP config for demo server |

Options: `--demo`, `--budget <tokens>`, `-o` output path.

## Demo vs production

| Mode | Status |
|------|--------|
| **Demo** (`serve`) | Free — lists optimized tools, returns simulated responses |
| **Production** (real HTTP) | Roadmap — star the repo for updates |

## Develop locally

```bash
git clone https://github.com/louisreid/mcp-slim.git
cd mcp-slim
pnpm install
pnpm build
node dist/cli.js analyze --demo
node dist/cli.js serve --demo
```

## How optimization works

1. **trim-descriptions** — cap verbose OpenAPI text  
2. **slim-schema** — strip examples, shorten property docs  
3. **group-by-tag** — one `discover_<tag>` tool per OpenAPI tag  
4. **budget** (optional) — fit under a token cap  

## Feedback

Open an issue or PR: [github.com/louisreid/mcp-slim](https://github.com/louisreid/mcp-slim)

Built as part of [Coefficient](https://github.com/louisreid/coefficient) investigation (A3 hypothesis).

## License

MIT
