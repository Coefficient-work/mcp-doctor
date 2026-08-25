# Agent guide

Repository: mcp-slim

## Codex vs Cursor (agent routing)

Use the **codex-vs-cursor** skill when choosing the coding agent for a job:

- **Cursor** — daily IDE (UI, Flutter, Payload admin, TARS ops, fuzzy explore/debug, live diffs)
- **Codex** — walk-away / async (scoped migrations, schema PRs, batch fixes, large refactors → PR)

Skill: `.cursor/skills/codex-vs-cursor/SKILL.md` · re-install: `bash /Users/louisreid/Documents/tars/scripts/install-codex-vs-cursor-skill.sh`

**Prompt:** `Use codex-vs-cursor. Job: … Repo: … Interactive now or walk-away PR?`

## TARS remote API (Gmail / Drive / Sheets) — mandatory

**Always** use **tars-remote-api** for Louis’s Gmail, Miriam’s Gmail (`account:"mim"` → `evamiriam.reid@gmail.com`), and Google Drive/Sheets/Docs via Mac mini `:3049`.
**Do not** use Cursor `plugin-gmail` / `plugin-google-drive` or local Google OAuth in this repo.

Skill: `.cursor/skills/tars-remote-api/SKILL.md`
Re-install: `bash /Users/louisreid/Documents/tars/scripts/install-tars-remote-api-skill.sh`

**Cursor secrets (Cloud Agent only):** `REID_REMOTE_TOKEN`, `MAC_MINI_HOST`, `TAILSCALE_AUTH_KEY` — not injected in Build Locally.

**Preflight:** `bash /Users/louisreid/Documents/tars/scripts/tars-remote-preflight.sh`

**Hub:** [tars cross-repo bridge](/Users/louisreid/Documents/tars/docs/tars/cross-repo-agent-bridge.md) · [google-api README](/Users/louisreid/Documents/tars/services/google-api/README.md)

**Prompts:**
- `Use tars-remote-api skill. Run preflight, then search Gmail …`
- `Use tars-remote-api skill. Run preflight. Search Mim Gmail (account:mim) …`
- `Use tars-remote-api skill. Run preflight. Search Drive … (not the Drive plugin)`

## Cross-machine file fetch (Mini ↔ Air)

When a path is on the other Mac (Mini ↔ Air), use skill **`cross-machine-fetch`**
(`~/.cursor/skills/cross-machine-fetch` · `.cursor/skills/cross-machine-fetch`).

| Machine | Host alias | IP | User |
|---------|------------|-----|------|
| Mini | `mini` / `roundtableopenclaw` | `100.84.168.56` | `roundtableopenclaw` |
| Air | `air` / `louiss-macbook-air` | `100.83.203.72` | `louisreid` |

Helper: `bash scripts/cross-machine/fetch-from-peer.sh --peer louiss-macbook-air --user louisreid --remote "…" --out ~/Downloads/`
(or `bash ~/.cursor/skills/cross-machine-fetch/scripts/fetch-from-peer.sh …`).

Requires Remote Login (or Tailscale SSH) + pubkey. Mini→Air uses `IdentityFile ~/.ssh/reid-finance-deploy`.
Re-install: `bash /Users/louisreid/Documents/tars/scripts/install-cross-machine-fetch-skill.sh`
