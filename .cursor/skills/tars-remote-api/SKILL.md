---
name: tars-remote-api
description: >-
  MANDATORY for Louis’s Gmail, Miriam’s Gmail, and Google Drive/Sheets/Docs:
  call TARS Mac mini remote API (:3049) via Tailscale — never Cursor
  plugin-gmail / plugin-google-drive or local OAuth in project repos.
  Use whenever an agent needs email search/read/draft, Drive search, Sheets,
  or Docs from any repo (jobs-foundation, WTC, paedia, etc.).
---

# TARS remote API — agent skill

## Hard rule (read first)

For **Louis’s Gmail**, **Miriam’s (Mim’s) Gmail**, or **Google Drive / Sheets / Docs** in household, business, or ops context:

1. **Always** use this skill → Mac mini `:3049` remote API.
2. **Do not** use Cursor MCP plugins `plugin-gmail-gmail` or `plugin-google-drive-google-drive` as the first choice (or as a fallback when TARS is available).
3. **Do not** set up local Google OAuth, service-account JSON, or refresh tokens in project repos.
4. **Do not** invent alternate Google auth paths “because this isn’t the TARS repo.”

If preflight fails, **stop and report the printed fix** — do not silently switch to plugins or claim “Gmail isn’t authenticated.”

## When to use

- Any Gmail search, read, draft, or label/modify for Louis or Mim
- Google Drive file search; Sheets get/update/append; Docs get/batchUpdate
- User mentions TARS, Mac mini, `:3049`, cross-repo Google, Antagning/LU (Mim), or household Drive
- Errors: `REID_REMOTE_TOKEN not set`, `401 Unauthorized`, or agent temptation to open Gmail/Drive plugins

## Anti-patterns

| Don’t | Do instead |
|-------|------------|
| Call `plugin-gmail-*` / `plugin-google-drive-*` for Louis/Mim/ops mail or Drive | `tars-remote-api` + `:3049` |
| Copy OAuth client secrets / refresh tokens into a project `.env` | OAuth stays on Mac mini (`~/openclaw/.env`) only |
| Re-implement Google auth or “temporary” local Gmail scripts in jobs-foundation etc. | Preflight + `curl` / `tars-remote.sh` |
| Guess “not authenticated” without running preflight | Run preflight; quote its failure message |
| Default Mim mail to Louis’s mailbox | Pass `"account":"mim"` (or Mim mailbox alias) |
| Assume Drive works for Mim | Drive/Sheets/Docs are **Louis only**; Mim is Gmail-only |

## Prerequisites (Cursor secrets — set once)

Add in **Cursor Settings → Cloud Agents → Secrets** ([cursor.com/docs/cloud-agent/setup](https://cursor.com/docs/cloud-agent/setup)). Secrets are **account/workspace-scoped**, not per-repo.

| Secret | Required | Purpose |
|--------|----------|---------|
| `REID_REMOTE_TOKEN` | **Yes** | Bearer token from Mac mini `~/openclaw/.env` |
| `MAC_MINI_HOST` | **Yes** | Tailscale IP (default `100.84.168.56`) |
| `TAILSCALE_AUTH_KEY` | Cloud Agents only | Ephemeral key (`tag:automation`) to join tailnet |

Use secret type **Runtime Secret** (not build-time only).

**Never** store Google OAuth refresh tokens in project repos. OAuth lives on Mac mini only.

**Full spec:** [cross-repo-agent-bridge.md](/Users/louisreid/Documents/tars/docs/tars/cross-repo-agent-bridge.md) · [services/google-api/README.md](/Users/louisreid/Documents/tars/services/google-api/README.md)

## Cloud Agent vs local / Build Locally

| Session | Secrets injected? | Tailnet? | What agents see |
|---------|-------------------|----------|-----------------|
| **Cloud Agent** | Yes — token + host + Tailscale auth | Yes (ephemeral node) | `curl` with `$REID_REMOTE_TOKEN` works |
| **Build Locally** / local Mac agent | **No** cloud secrets | Your Mac’s Tailscale | Export token locally or fail loudly |

**Local workaround (Louis only, never commit):**

```bash
export REID_REMOTE_TOKEN='…'   # from Mac mini ~/openclaw/.env
export MAC_MINI_HOST='100.84.168.56'
```

## Preflight (run before every Google call)

```bash
bash /Users/louisreid/Documents/tars/scripts/tars-remote-preflight.sh
```

Exits 0 only when token is set **and** `GET /google/status` returns 200. If it fails, report the printed fix — do not guess or fall back to plugins.

On Mini, hub path may be `/Users/roundtableopenclaw/Documents/tars/scripts/tars-remote-preflight.sh`.

## Base URL

```
http://${MAC_MINI_HOST}:3049/google/<service>/<action>
Authorization: Bearer ${REID_REMOTE_TOKEN}
```

Health: `GET http://${MAC_MINI_HOST}:3049/google/status`  
Status includes `accounts.louis.ready` and `accounts.mim.ready`.

## Accounts

| `account` | Mailbox | Routes | Notes |
|-----------|---------|--------|-------|
| omit / `"louis"` | Louis (default) | Gmail + Drive + Sheets + Docs | Business / Roundtable / email-router |
| `"mim"` | `evamiriam.reid@gmail.com` | **Gmail only** (search / get / draft / modify) | Antagning, LU, Mim course admin |

Also accepted: `"mailbox":"evamiriam.reid@gmail.com"` → Mim.

**If unsure which mailbox:** ask Louis, or check context (Antagning / LU / “Mim’s mail” → mim; Roundtable / jobs / ops → louis). Verify Mim with status `accounts.mim.ready` before Mim calls.

Optional draft From override on Mini: `GOOGLE_GMAIL_FROM_MIM='Eva Miriam Reid <evamiriam.reid@gmail.com>'` (hub env — agents do not set this).

## Gmail

### Search

```bash
curl -sS -X POST "http://${MAC_MINI_HOST}:3049/google/gmail/search" \
  -H "Authorization: Bearer ${REID_REMOTE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query":"from:jamie@good.space","maxResults":5}'
```

Mim (e.g. Antagning / LU):

```bash
curl -sS -X POST "http://${MAC_MINI_HOST}:3049/google/gmail/search" \
  -H "Authorization: Bearer ${REID_REMOTE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query":"from:antagning.se OR from:lu.se","account":"mim","maxResults":5}'
```

Returns `{ id, threadId, from, to, subject, date, snippet, bodyText }` (array).

### Get one message

```bash
curl -sS -X POST "http://${MAC_MINI_HOST}:3049/google/gmail/get" \
  -H "Authorization: Bearer ${REID_REMOTE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"19f4b9153758e91e"}'
```

Add `"account":"mim"` when the messageId came from a Mim search.

### Create draft (no send)

```bash
curl -sS -X POST "http://${MAC_MINI_HOST}:3049/google/gmail/draft" \
  -H "Authorization: Bearer ${REID_REMOTE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"to":["jamie@good.space"],"subject":"Re: …","body":"…","threadId":"optional"}'
```

Mim draft: include `"account":"mim"`. Louis or Mim reviews and sends in Gmail — hub has **no** `gmail.send`.

**HTML formatting (not yet live):** plain `body` only today. Spec: [prompt-gmail-draft-html-formatting.md](/Users/louisreid/Documents/tars/docs/tars/prompt-gmail-draft-html-formatting.md).

## Google Drive (Louis only)

```bash
curl -sS -X POST "http://${MAC_MINI_HOST}:3049/google/drive/search" \
  -H "Authorization: Bearer ${REID_REMOTE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query":"mimeType='\''application/vnd.google-apps.spreadsheet'\''","pageSize":20}'
```

`query` is a [Drive files.list `q`](https://developers.google.com/drive/api/guides/search-files) string. Returns `{ files: [{ id, name, mimeType, modifiedTime, webViewLink }] }`.

Do **not** use Cursor Drive plugin for household/ops Drive when `:3049` is reachable.

## Google Sheets / Docs (Louis only)

```bash
curl -sS -X POST "http://${MAC_MINI_HOST}:3049/google/sheets/get" \
  -H "Authorization: Bearer ${REID_REMOTE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"spreadsheetId":"YOUR_SHEET_ID","range":"Sheet1!A1:Z100"}'
```

Also live: `sheets/update`, `sheets/append`, `sheets/batchUpdate`, `docs/get`, `docs/batchUpdate` — see [services/google-api/README.md](/Users/louisreid/Documents/tars/services/google-api/README.md).

## Error handling

| Symptom | Meaning | Fix |
|---------|---------|-----|
| `REID_REMOTE_TOKEN not set` | Env absent (common in project repos / Build Locally) | Cloud: Runtime Secret; Local: `export` |
| Agent opens Gmail/Drive **plugin** instead | Skill ignored | Re-read hard rule; refuse plugins for Louis/Mim/ops |
| Agent says “Gmail isn’t authenticated” without API call | Guessing | Run preflight; use this skill |
| `401` | Wrong bearer | Re-copy from Mini `~/openclaw/.env` |
| `accounts.mim.ready` false | Mim OAuth missing on Mini | Louis: `pnpm google:oauth -- --account=mim` on Mini |
| Connection refused / timeout | Off tailnet or Mini down | `TAILSCALE_AUTH_KEY` / `tailscale status` / `remote.sh health` |

## Thin wrapper (optional)

```bash
bash /Users/louisreid/Documents/tars/scripts/tars-remote.sh gmail/search '{"query":"from:jamie@good.space","maxResults":5}'
bash /Users/louisreid/Documents/tars/scripts/tars-remote.sh drive/search '{"query":"name contains '\''budget'\''","pageSize":10}'
```

## Install / redeploy

```bash
# Air + all Documents repos + optional Mini
bash /Users/louisreid/Documents/tars/scripts/install-tars-remote-api-skill.sh --with-mini
```

## AGENTS.md block (install script patches this)

```markdown
## TARS remote API (Gmail / Drive / Sheets) — mandatory

**Always** use **tars-remote-api** for Louis’s Gmail, Miriam’s Gmail (`account:"mim"`), and Google Drive/Sheets/Docs via Mac mini `:3049`.
**Do not** use Cursor `plugin-gmail` / `plugin-google-drive` or local OAuth in this repo.

Skill: `.cursor/skills/tars-remote-api/SKILL.md`
Re-install: `bash /Users/louisreid/Documents/tars/scripts/install-tars-remote-api-skill.sh --with-mini`

**Secrets (Cloud Agent):** `REID_REMOTE_TOKEN`, `MAC_MINI_HOST`, `TAILSCALE_AUTH_KEY`
**Preflight:** `bash /Users/louisreid/Documents/tars/scripts/tars-remote-preflight.sh`
```

## Workflow

1. **Read this skill** (required in every repo).
2. Run **preflight**; on failure, stop and tell Louis.
3. Call the route (search → get → draft / drive search / sheets…).
4. Persist results in project memory if needed; **never** commit tokens.

### Copy-paste prompts

```
Use tars-remote-api skill. Run preflight, then search Gmail from:jamie@good.space
```

```
Use tars-remote-api skill. Run preflight. Search Mim Gmail (account:mim) for antagning/LU. Summarize.
```

```
Use tars-remote-api skill. Run preflight. Search Drive for …. Do not use Google Drive plugin.
```

```
Use tars-remote-api skill. Run preflight. Search thread, create Gmail draft (plain text) via POST /google/gmail/draft — Louis/Mim sends manually.
```
