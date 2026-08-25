#!/usr/bin/env bash
# Fetch files from a Tailscale peer onto this Mac (Mini ↔ Air).
# Usage:
#   fetch-from-peer.sh --peer louiss-macbook-air --user louisreid \
#     --remote "/Users/louisreid/Downloads/foo.csv" --out ~/Downloads/
set -euo pipefail

PEER=""
USER_NAME=""
OUT_DIR=""
REMOTES=()
IDENTITY=""

usage() {
  sed -n '2,6p' "$0" | sed 's/^# //'
  echo "Options: --peer NAME  --user USER  --remote PATH (repeatable)  --out DIR  [--identity FILE]"
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --peer) PEER="$2"; shift 2 ;;
    --user) USER_NAME="$2"; shift 2 ;;
    --remote) REMOTES+=("$2"); shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    --identity) IDENTITY="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown arg: $1" >&2; usage 1 ;;
  esac
done

if [[ -z "$PEER" || -z "$USER_NAME" || ${#REMOTES[@]} -eq 0 ]]; then
  echo "Need --peer, --user, and at least one --remote" >&2
  usage 1
fi

OUT_DIR="${OUT_DIR:-$HOME/Downloads/cross-machine-fetch}"
mkdir -p "$OUT_DIR"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale CLI not found on this machine" >&2
  exit 2
fi

# Default identity: Mini→Air uses reid-finance-deploy when present.
if [[ -z "$IDENTITY" ]]; then
  case "$(echo "$PEER" | tr '[:upper:]' '[:lower:]')" in
    *macbook*|*air*|louiss-macbook-air)
      if [[ -f "$HOME/.ssh/reid-finance-deploy" ]]; then
        IDENTITY="$HOME/.ssh/reid-finance-deploy"
      fi
      ;;
  esac
fi

# Resolve peer by MagicDNS short name or substring.
# Note: do not early-exit awk while tailscale is still writing — under pipefail
# that SIGPIPEs the pipeline (exit 141) and aborts the script under set -e.
resolve_peer() {
  local want="$1"
  local w
  w="$(echo "$want" | tr '[:upper:]' '[:lower:]')"
  # grep -m1 closes after first match; || true keeps pipefail from aborting.
  local line
  line="$(tailscale status 2>/dev/null | grep -i -m1 -F "$want" || true)"
  if [[ -z "$line" && "$w" =~ macbook|air|louis ]]; then
    line="$(tailscale status 2>/dev/null | grep -i -m1 'louiss-macbook-air' || true)"
  fi
  if [[ -n "$line" ]]; then
    # shellcheck disable=SC2086
    set -- $line
    echo "$1 $2"
  fi
}

PEER_LINE="$(resolve_peer "$PEER")"
if [[ -z "$PEER_LINE" ]]; then
  echo "Peer '$PEER' not found in tailscale status (offline or wrong name)." >&2
  echo "Run: tailscale status" >&2
  exit 3
fi

IP="$(awk '{print $1}' <<<"$PEER_LINE")"
HOST="$(awk '{print $2}' <<<"$PEER_LINE")"
HOST="${HOST:-$PEER}"
TARGET="${USER_NAME}@${HOST}"
echo "Peer online: $HOST ($IP)"
[[ -n "$IDENTITY" ]] && echo "Identity: $IDENTITY"

ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
scp_opts=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
if [[ -n "$IDENTITY" && -f "$IDENTITY" ]]; then
  ssh_opts+=(-o IdentitiesOnly=yes -i "$IDENTITY")
  scp_opts+=(-o IdentitiesOnly=yes -i "$IDENTITY")
fi

ssh_base=(ssh "${ssh_opts[@]}")
scp_base=(scp "${scp_opts[@]}")

try_copy() {
  local remote="$1"
  local dest="$2"
  # 1) classic scp to MagicDNS
  if "${scp_base[@]}" "${TARGET}:${remote}" "$dest" 2>/tmp/cross-machine-scp.err; then
    return 0
  fi
  # 2) scp via Tailscale IP
  if [[ -n "$IP" ]] && "${scp_base[@]}" "${USER_NAME}@${IP}:${remote}" "$dest" 2>/tmp/cross-machine-scp.err; then
    return 0
  fi
  # 3) Host alias from ~/.ssh/config (air / mini)
  if "${scp_base[@]}" "air:${remote}" "$dest" 2>/tmp/cross-machine-scp.err; then
    return 0
  fi
  # 4) tailscale ssh + remote cat (when scp path differs but ssh works)
  if command -v tailscale >/dev/null 2>&1; then
    if tailscale ssh "${TARGET}" -- "test -f $(printf %q "$remote")" 2>/tmp/cross-machine-ssh.err; then
      if tailscale ssh "${TARGET}" -- "cat $(printf %q "$remote")" >"$dest" 2>/tmp/cross-machine-ssh.err; then
        return 0
      fi
    fi
  fi
  return 1
}

failed=0
for remote in "${REMOTES[@]}"; do
  base="$(basename "$remote")"
  dest="${OUT_DIR%/}/$base"
  echo "Fetching ${TARGET}:${remote} → $dest"
  if try_copy "$remote" "$dest"; then
    ls -la "$dest"
  else
    failed=1
    echo "FAILED: $remote" >&2
    [[ -f /tmp/cross-machine-scp.err ]] && echo "scp: $(tail -3 /tmp/cross-machine-scp.err)" >&2
    [[ -f /tmp/cross-machine-ssh.err ]] && echo "ssh: $(tail -3 /tmp/cross-machine-ssh.err)" >&2
  fi
done

if [[ "$failed" -ne 0 ]]; then
  cat >&2 <<'EOF'

Could not fetch one or more files.

Checks:
  1) Peer online on Tailscale?  tailscale status
  2) Port 22 open?             nc -z -G 3 louiss-macbook-air 22
  3) Remote Login on (Air)?    System Settings → Sharing → Remote Login
  4) Pubkey authorized?        Permission denied → add Mini pubkey to Air ~/.ssh/authorized_keys
     (see cross-machine-fetch SKILL.md — reid-finance-deploy)

Then re-run this script. Or attach the file in Cursor chat.
EOF
  exit 4
fi

echo "OK → $OUT_DIR"
