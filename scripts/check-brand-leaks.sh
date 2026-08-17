#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN='github\.com/louisreid|github:louisreid|roundtable\.co\.uk|Coefficient AI Inc\.|npx github:louisreid/mcp-doctor|npx github:coefficient-ai/mcp-doctor|github:coefficient-ai/mcp-doctor|@coefficient-ai/mcp-doctor'

if grep -R -n -E -I "$PATTERN" README.md LICENSE docs examples src dist package.json \
  --exclude-dir=node_modules \
  --exclude-dir=.git; then
  echo "Brand leak check failed." >&2
  exit 1
fi

echo "Brand leak check passed."
