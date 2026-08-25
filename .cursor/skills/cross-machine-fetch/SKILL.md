---
name: cross-machine-fetch
description: >-
  Fetch files from Louis's other Macs over Tailscale SSH (Mini ↔ Air).
  Use when a path is on another machine (e.g. /Users/louisreid/Downloads on the
  Air while the agent runs on the Mini), Downloads CSVs/PDFs are missing locally,
  or the user says pull via SSH / get the file from my MacBook.
---

# Cross-machine fetch (Tailscale / Remote Login SSH)

## When to use

- User gives an absolute path under `/Users/louisreid/...` but the agent runs on the **Mini** (`roundtableopenclaw`)
- Local `ls` fails with “No such file” for Downloads CSVs/PDFs that Louis just exported on the Air
- User asks to SSH to the MacBook / Air and pull files

Do **not** invent file contents. Fetch or ask — never fake bank/CSV data.

## Machine map (bidirectional)

| Role | Tailscale / Host alias | Typical IP | SSH user | Home |
|------|------------------------|------------|----------|------|
| Mini (agents often here) | `roundtableopenclaw` / `mini` | `100.84.168.56` | `roundtableopenclaw` | `/Users/roundtableopenclaw` |
| MacBook Air (Louis daily) | `louiss-macbook-air` / `air` | `100.83.203.72` | `louisreid` | `/Users/louisreid` |

Resolve live: `tailscale status` (prefer MagicDNS name over hardcoding the IP).

### Preferred auth

1. **macOS Remote Login** (classic SSH on port 22) — preferred when Tailscale CLI/daemon versions disagree. System Settings → General → Sharing → **Remote Login** → On (allow the peer user).
2. **Tailscale SSH** — optional: `sudo tailscale set --ssh` only when CLI and GUI share the same daemon.

BatchMode (agent) fetches need a **pubkey** in the peer’s `~/.ssh/authorized_keys`. Password prompts will fail under BatchMode.

### Identity files

| Direction | Client | Key to offer | Where it must be authorized |
|-----------|--------|--------------|-----------------------------|
| Mini → Air | Mini | `~/.ssh/reid-finance-deploy` (ed25519) | Air: `~louisreid/.ssh/authorized_keys` |
| Air → Mini | Air | Louis’s Mac key (matches Mini `authorized_keys`) | Mini: `~roundtableopenclaw/.ssh/authorized_keys` |

SSH config Host aliases (install script / manual):

```
Host air louiss-macbook-air
  HostName 100.83.203.72
  User louisreid
  IdentityFile ~/.ssh/reid-finance-deploy
  IdentitiesOnly yes

Host mini roundtableopenclaw
  HostName 100.84.168.56
  User roundtableopenclaw
  IdentitiesOnly yes
```

Then: `scp air:~/Downloads/foo.csv ~/Downloads/` or the helper below.

## Workflow

1. Confirm the file is missing on **this** machine (`ls` the path).
2. Confirm the peer is online: `tailscale status | grep -i macbook` (or the peer name).
3. Fetch with the helper (preferred):

```bash
bash ~/.cursor/skills/cross-machine-fetch/scripts/fetch-from-peer.sh \
  --peer louiss-macbook-air \
  --user louisreid \
  --remote "/Users/louisreid/Downloads/transactions.csv" \
  --out "/Users/roundtableopenclaw/Downloads/"
```

Multiple remotes:

```bash
bash ~/.cursor/skills/cross-machine-fetch/scripts/fetch-from-peer.sh \
  --peer louiss-macbook-air \
  --user louisreid \
  --remote "/Users/louisreid/Downloads/transactions.csv" \
  --remote "/Users/louisreid/Downloads/transactions (1).csv" \
  --out "/Users/roundtableopenclaw/Downloads/"
```

TARS repo copy of the same script: `scripts/cross-machine/fetch-from-peer.sh`.

4. Verify with `ls -la` on the `--out` paths, then continue the original task (parse CSV, etc.).
5. Do **not** commit raw bank/credit-card exports to git. Stage under Downloads / `/tmp` / gitignored paths only.

## If SSH is refused

| Symptom | Meaning | Fix |
|---------|---------|-----|
| `Connection refused` on port 22 | Remote Login / Tailscale SSH off | On Air: enable Remote Login (or `sudo tailscale set --ssh`) |
| `Permission denied (publickey,…)` with BatchMode | Peer online + port open, but key missing | Add Mini pubkey to Air `authorized_keys` (see below) |

### Mini → Air: authorize Mini key (Louis, once, on Air)

From Mini, the pubkey is:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMLu66HxqdBfcitlhVG3vzvjmrrlcCLvS84RgigB9hoX Mac mini TARS reid-finance
```

On the **Air** (Terminal as `louisreid`):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
grep -q 'Mac mini TARS reid-finance' ~/.ssh/authorized_keys 2>/dev/null || \
  echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMLu66HxqdBfcitlhVG3vzvjmrrlcCLvS84RgigB9hoX Mac mini TARS reid-finance' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Then from Mini: `ssh -o BatchMode=yes air 'echo OK_FROM_AIR'`.

If still blocked, ask Louis to attach the file in chat — do not keep retrying blindly.

## Security

- BatchMode only (no password prompts in agent sessions).
- Read-only fetch (`scp` remote → local). Do not push to the Air unless Louis explicitly asks.
- Never print full card PANs from fetched CSVs into chat; summarize merchants/amounts.
- Prefer Tailscale network only (peer MagicDNS / `100.x` addresses).

## Install everywhere

```bash
bash /Users/roundtableopenclaw/Documents/tars/scripts/install-cross-machine-fetch-skill.sh
# From Air (after Mini→Air SSH works): same script via --with-air, or
# bash scripts/install-cross-machine-fetch-skill.sh --local-only
```

Copies skill to `~/.cursor/skills/cross-machine-fetch` and every git repo under `Documents/` (and `Projects/` if present) as `.cursor/skills/cross-machine-fetch/`. Mentions both Mini and Air in the installer help.

## Quick probe

```bash
tailscale status | grep -iE 'macbook|air|roundtable'
nc -z -G 3 louiss-macbook-air 22 && echo ssh_open || echo ssh_closed
ssh -o BatchMode=yes -o ConnectTimeout=10 air 'echo OK_FROM_AIR; whoami; hostname'
# Air → Mini (from Air):
ssh -o BatchMode=yes -o ConnectTimeout=10 mini 'echo OK_FROM_MINI; whoami'
```
