#!/usr/bin/env bash
# Layer 2: pack the CLI, copy it into an empty temp workspace, spawn a fresh
# Cursor agent (or Codex) with no parent-repo context.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT_SRC="$ROOT/scripts/blind-eval-prompt.md"
RUNNER="${MCP_DOCTOR_BLIND_RUNNER:-agent}"

cd "$ROOT"

echo "==> npm pack"
rm -f "$ROOT"/coefficient-work-mcp-doctor-*.tgz
npm pack
TARBALL="$(ls -1 "$ROOT"/coefficient-work-mcp-doctor-*.tgz | head -n 1)"
[[ -f "$TARBALL" ]] || { echo "blind-eval FAIL: npm pack produced no tarball" >&2; exit 1; }

SANDBOX="$(mktemp -d /tmp/mcp-doctor-blind-XXXXXX)"
cp "$TARBALL" "$SANDBOX/mcp-doctor.tgz"
cp "$PROMPT_SRC" "$SANDBOX/PROMPT.md"
# Isolation: tarball + prompt only. No git, no AGENTS.md, no parent repo.
echo "sandbox: $SANDBOX"

run_agent() {
  local prompt
  prompt="$(cat "$SANDBOX/PROMPT.md")"
  AGENT_LOG="$SANDBOX/agent.log"
  case "$RUNNER" in
    codex)
      if ! command -v codex >/dev/null 2>&1; then
        echo "SKIP: codex not on PATH. Layer 1 (npm run prepublish-gate) is the required publish check."
        echo "sandbox left at $SANDBOX"
        return 2
      fi
      (cd "$SANDBOX" && codex exec --skip-git-repo-check --cd "$SANDBOX" "$prompt") 2>&1 | tee "$AGENT_LOG"
      return "${PIPESTATUS[0]}"
      ;;
    agent|*)
      if ! command -v agent >/dev/null 2>&1; then
        echo "SKIP: agent not on PATH. Layer 1 (npm run prepublish-gate) is the required publish check."
        echo "sandbox left at $SANDBOX"
        return 2
      fi
      # Cursor headless: -p print, --force allow commands, --trust this workspace.
      # Prompt is positional ( -p is a boolean ). Must run with cwd = sandbox.
      (
        cd "$SANDBOX"
        agent -p --force --trust --workspace "$SANDBOX" "$prompt"
      ) 2>&1 | tee "$AGENT_LOG"
      return "${PIPESTATUS[0]}"
      ;;
  esac
}

set +e
run_agent
agent_code=$?
set -e

if [[ "$agent_code" -eq 2 ]]; then
  exit 0
fi

if [[ "$agent_code" -ne 0 ]]; then
  echo "blind-eval FAIL: $RUNNER exited $agent_code (sandbox $SANDBOX)" >&2
  if [[ -f "${AGENT_LOG:-}" ]] && grep -q "login keychain is locked" "$AGENT_LOG"; then
    echo "Cause: macOS login keychain is locked. Unlock it in a GUI session on this Mac:" >&2
    echo "  security unlock-keychain ~/Library/Keychains/login.keychain-db" >&2
    echo "Then re-run: npm run blind-eval" >&2
    echo "Do not treat this as a publish skip: the anonymous agent pass did not run." >&2
  fi
  exit 1
fi

REPORT="$SANDBOX/REPORT.md"
inspect_regression() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  if grep -q "100/100" "$file" && grep -Eq "Tools \(live\) \| 0" "$file"; then
    echo "REGRESSION: $file has 100/100 with Tools (live) | 0" >&2
    echo "sandbox: $SANDBOX"
    exit 1
  fi
  if grep -q "Grade F" "$file" && grep -q "No high-priority fixes suggested" "$file"; then
    echo "REGRESSION: Grade F next to 'No high-priority fixes suggested' in $file" >&2
    echo "sandbox: $SANDBOX"
    exit 1
  fi
}

if [[ -f "$REPORT" ]]; then
  inspect_regression "$SANDBOX/inspect-before.md"
  inspect_regression "$SANDBOX/reports/inspect-before.md"
  inspect_regression "$SANDBOX/inspect-after.md"
  inspect_regression "$SANDBOX/reports/inspect-after.md"
  if grep -q "100/100" "$REPORT" && grep -Eq "Tools \(live\) \| 0" "$REPORT"; then
    echo "REGRESSION: REPORT.md has 100/100 with Tools (live) | 0" >&2
    echo "sandbox: $SANDBOX"
    exit 1
  fi
  echo "blind-eval wrote $REPORT"
else
  echo "blind-eval: agent finished but REPORT.md was not written (sandbox $SANDBOX)"
fi

echo "sandbox: $SANDBOX"
