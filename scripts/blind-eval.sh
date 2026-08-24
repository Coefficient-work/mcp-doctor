#!/usr/bin/env bash
# Layer 2: pack the CLI, copy it into an empty temp workspace, spawn a fresh
# Cursor agent (or Codex) with no parent-repo context.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT_SRC="$ROOT/scripts/blind-eval-prompt.md"
RUNNER="${MCP_DOCTOR_BLIND_RUNNER:-agent}"
BLIND_MODELS="${MCP_DOCTOR_BLIND_MODELS:-openrouter/openai/gpt-5.6-sol,openrouter/anthropic/claude-sonnet-5,openrouter/google/gemini-3.7-flash}"
CODEX_MODEL="${MCP_DOCTOR_BLIND_CODEX_MODEL:-gpt-5.6-sol}"
CODEX_REASONING="${MCP_DOCTOR_BLIND_CODEX_REASONING_EFFORT:-medium}"

cd "$ROOT"

echo "==> npm pack"
rm -f "$ROOT"/coefficient-work-mcp-doctor-*.tgz
npm pack
TARBALL="$(ls -1 "$ROOT"/coefficient-work-mcp-doctor-*.tgz | head -n 1)"
[[ -f "$TARBALL" ]] || { echo "blind-eval FAIL: npm pack produced no tarball" >&2; exit 1; }

SANDBOX="$(mktemp -d /tmp/mcp-doctor-blind-XXXXXX)"
cp "$TARBALL" "$SANDBOX/mcp-doctor.tgz"
sed "s|__MCP_DOCTOR_BLIND_MODELS__|$BLIND_MODELS|g" "$PROMPT_SRC" > "$SANDBOX/PROMPT.md"
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
      (
        cd "$SANDBOX"
        export npm_config_cache="$SANDBOX/.npm-cache"
        codex exec \
          --skip-git-repo-check \
          --cd "$SANDBOX" \
          --ephemeral \
          --ignore-user-config \
          --ignore-rules \
          --dangerously-bypass-approvals-and-sandbox \
          --model "$CODEX_MODEL" \
          --config "model_reasoning_effort=\"$CODEX_REASONING\"" \
          "$prompt"
      ) 2>&1 | tee "$AGENT_LOG"
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
  echo "blind-eval FAIL: no isolated agent runner completed the required layer-2 gate" >&2
  exit 1
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
  printf '%s\n' "$(node -p "require('./package.json').version")" > "$SANDBOX/package-version.txt"
  printf '%s\n' \
    "MCP_DOCTOR_BLIND_MODELS=$BLIND_MODELS MCP_DOCTOR_BLIND_CODEX_MODEL=$CODEX_MODEL MCP_DOCTOR_BLIND_CODEX_REASONING_EFFORT=$CODEX_REASONING npm run blind-eval" \
    > "$SANDBOX/invocation.txt"
  node "$ROOT/scripts/validate-blind-artifacts.mjs" "$SANDBOX" "$BLIND_MODELS"
  echo "blind-eval wrote $REPORT"
else
  echo "blind-eval FAIL: agent finished but REPORT.md was not written (sandbox $SANDBOX)" >&2
  exit 1
fi

echo "sandbox: $SANDBOX"
