# Friend guide � evaluate your company's MCP

**Goal:** Connect to your team's MCP server (e.g. Vooma), run an agent-readiness scorecard, and send Louis a short feedback note.

**Time:** ~5 minutes  
**Requires:** Node 22 or Node 24 LTS recommended (Node 20 remains compatible with `0.4.7`), plus your MCP already working in Cursor (or the URL/command from your team)

---

## Quick start (Vooma or any MCP in Cursor)

### 1. See what MCP servers you have configured

```bash
npx --yes --package @coefficient-work/mcp-doctor@0.4.7 mcp-doctor list
```

Looks in `~/.cursor/mcp.json` (and Claude Desktop config on Mac). You should see server names like `vooma`, `vooma-production`, etc.

### 2. Inspect your live MCP server

Replace `vooma` with the exact name from step 1:

```bash
npx --yes --package @coefficient-work/mcp-doctor@0.4.7 mcp-doctor inspect vooma
```

Save the report:

```bash
npx --yes --package @coefficient-work/mcp-doctor@0.4.7 mcp-doctor inspect vooma -o vooma-mcp-report.md
```

Email or Slack the `.md` file to Louis, plus fill in the **Feedback** section at the bottom.

### 3. If you use a custom config path

```bash
npx --yes --package @coefficient-work/mcp-doctor@0.4.7 mcp-doctor inspect vooma --config /path/to/mcp.json -o report.md
```

### 4. If you have a direct MCP URL (no Cursor config)

```bash
npx --yes --package @coefficient-work/mcp-doctor@0.4.7 mcp-doctor inspect --url https://your-mcp-host/mcp \
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

**BYOK eval:** `inspect` needs no model key. `eval` accepts OpenRouter, OpenAI, Anthropic, Vercel AI Gateway, or Ollama credentials. For a cross-provider matrix, put an `OPENROUTER_API_KEY` in `~/.config/mcp-doctor/evaluation.env`, run `chmod 600` on that file, and use explicit `openrouter/...` model slugs.

```bash
npx --yes --package @coefficient-work/mcp-doctor@0.4.7 mcp-doctor eval memory --task "List all tools" \
  --models openrouter/openai/gpt-5.6-sol,openrouter/anthropic/claude-sonnet-5,openrouter/google/gemini-3.7-flash \
  -o eval.md
```

Execution proof means at least one real MCP tool returned a non-error result. It is not a formal semantic judge of arbitrary task completion. Credential values stay local, but the task, tool schemas, calls, and results are sent to the selected model provider.

## See real example reports

- [State of MCP Quality 2026](../examples/reports/STATE-OF-MCP-2026.md)
- [Filesystem server report](../examples/reports/filesystem.md)

---

## Try the demo (no Vooma access needed)

```bash
npx --yes --package @coefficient-work/mcp-doctor@0.4.7 mcp-doctor test --demo
npx --yes --package @coefficient-work/mcp-doctor@0.4.7 mcp-doctor competitors --category testing
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
