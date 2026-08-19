# Friend guide � evaluate your company's MCP

**Goal:** Connect to your team's MCP server (e.g. Vooma), run an agent-readiness scorecard, and send Louis a short feedback note.

**Time:** ~5 minutes  
**Requires:** Node 20+, your MCP already working in Cursor (or the URL/command from your team)

---

## Quick start (Vooma or any MCP in Cursor)

### 1. See what MCP servers you have configured

```bash
npx @coefficient-work/mcp-doctor@latest list
```

Looks in `~/.cursor/mcp.json` (and Claude Desktop config on Mac). You should see server names like `vooma`, `vooma-production`, etc.

### 2. Inspect your live MCP server

Replace `vooma` with the exact name from step 1:

```bash
npx @coefficient-work/mcp-doctor@latest inspect vooma
```

Save the report:

```bash
npx @coefficient-work/mcp-doctor@latest inspect vooma -o vooma-mcp-report.md
```

Email or Slack the `.md` file to Louis, plus fill in the **Feedback** section at the bottom.

### 3. If you use a custom config path

```bash
npx @coefficient-work/mcp-doctor@latest inspect vooma --config /path/to/mcp.json -o report.md
```

### 4. If you have a direct MCP URL (no Cursor config)

```bash
npx @coefficient-work/mcp-doctor@latest inspect --url https://your-mcp-host/mcp \
  --header "Authorization:Bearer YOUR_TOKEN" \
  -o report.md
```

---

## Vooma-specific notes

Vooma builds AI agents for freight (quote ? cover ? schedule). Internal MCP servers may be:

- **Remote HTTP** � URL + bearer token in Cursor MCP settings
- **stdio** � `command` + `args` launching a local bridge

Public docs ([docs.vooma.ai](https://docs.vooma.ai)) list Agent Toolkits and Public API as *under construction* � your internal Cursor config is the source of truth.

**Don't have MCP in Cursor yet?** Ask your platform team for the MCP endpoint or stdio command used with Claude/Cursor. Template: [`examples/vooma-mcp.example.json`](../examples/vooma-mcp.example.json).

---

## What the scorecard checks

| Check | Why it matters for agents |
|-------|---------------------------|
| Tool count | Too many tools ? wrong tool picked |
| Token footprint | Bloated schemas waste context |
| Descriptions | Agents need clear tool docs |
| Destructive ops | Deletes without warnings are dangerous |
| Schema complexity | Deep JSON ? parameter mistakes |
| Security smells | Credentials on GET, shell exec |

**Not yet in v0.4 without API key:** agent eval requires `AI_GATEWAY_API_KEY` (Vercel AI Gateway free trial � BYOK). Static `inspect` and `benchmark` work without keys.

Get a key: [vercel.com/ai-gateway](https://vercel.com/ai-gateway) ? create key ? `export AI_GATEWAY_API_KEY=...`

```bash
npx @coefficient-work/mcp-doctor@latest eval memory --task "List all tools" -o eval.md
```

## See real example reports

- [State of MCP Quality 2026](../examples/reports/STATE-OF-MCP-2026.md)
- [Filesystem server report](../examples/reports/filesystem.md)

---

## Try the demo (no Vooma access needed)

```bash
npx @coefficient-work/mcp-doctor@latest test --demo
npx @coefficient-work/mcp-doctor@latest competitors --category testing
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No MCP config found` | Pass `--config ~/.cursor/mcp.json` |
| `Server "vooma" not in config` | Run `list` and use exact server name |
| Connection timeout | VPN on? Token expired? Try from same machine where Cursor works |
| `listTools` error | Auth header missing � check Cursor MCP JSON |
| HTTP fails, SSE works | Normal for older servers � report still valid |

---

## Questions?

Open an issue: [github.com/coefficient-work/mcp-doctor/issues](https://github.com/coefficient-work/mcp-doctor/issues)

Built by Louis Reid � design partner eval for freight/logistics MCP quality.
