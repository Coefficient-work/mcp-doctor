#!/usr/bin/env bash
# Run a prompt-only blind evaluation in the logged-in macOS GUI session.
# This avoids Terminal AppleEvents and gives Cursor Agent access to its GUI
# keychain credentials while keeping the evaluated workspace isolated.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_ROOT="${TMPDIR:-/tmp}/mcp-doctor-blind-jobs"
BLIND_MODELS="${MCP_DOCTOR_BLIND_MODELS:-openrouter/openai/gpt-5.6-sol,openrouter/anthropic/claude-sonnet-5,openrouter/google/gemini-3.7-flash}"

usage() {
  cat <<'EOF'
Usage:
  scripts/blind-eval-gui.sh start [prompt-path]
  scripts/blind-eval-gui.sh status <sandbox-path>
  scripts/blind-eval-gui.sh cleanup <sandbox-path>

start creates a fresh /tmp/mcp-doctor-blind-XXXXXX sandbox, copies only the
prompt into it, and starts Cursor Agent through a transient user LaunchAgent.
Eval credentials are loaded from ~/.config/mcp-doctor/evaluation.env on each
Mac (or MCP_DOCTOR_ENV_FILE when explicitly set); secret values are never shown.
status reports progress without reading secrets. cleanup unloads and removes
the transient job but deliberately leaves the sandbox and report intact.
EOF
}

require_macos_gui() {
  [[ "$(uname -s)" == "Darwin" ]] || {
    echo "blind-eval GUI runner requires macOS" >&2
    exit 2
  }
  launchctl print "gui/$(id -u)" >/dev/null 2>&1 || {
    echo "blind-eval GUI runner needs a logged-in GUI session" >&2
    exit 2
  }
}

job_parts() {
  local sandbox="$1"
  [[ "$sandbox" == /tmp/mcp-doctor-blind-* ]] || {
    echo "refusing unexpected sandbox path: $sandbox" >&2
    exit 2
  }
  JOB_ID="$(basename "$sandbox")"
  LABEL="com.coefficient.${JOB_ID//[^a-zA-Z0-9._-]/-}"
  STATE_DIR="$STATE_ROOT/$JOB_ID"
}

start_job() {
  require_macos_gui
  local prompt_src="${1:-$ROOT/scripts/blind-eval-prompt.md}"
  [[ -f "$prompt_src" ]] || {
    echo "prompt not found: $prompt_src" >&2
    exit 2
  }

  local agent_bin="${MCP_DOCTOR_BLIND_AGENT:-}"
  if [[ -z "$agent_bin" ]]; then
    agent_bin="$(command -v agent 2>/dev/null || true)"
  fi
  if [[ -z "$agent_bin" && -x "$HOME/.local/bin/agent" ]]; then
    agent_bin="$HOME/.local/bin/agent"
  fi
  [[ -x "$agent_bin" ]] || {
    echo "Cursor Agent executable not found; set MCP_DOCTOR_BLIND_AGENT" >&2
    exit 2
  }

  local sandbox
  sandbox="$(mktemp -d /tmp/mcp-doctor-blind-XXXXXX)"
  chmod 700 "$sandbox"
  (
    cd "$ROOT"
    rm -f "$ROOT"/coefficient-work-mcp-doctor-*.tgz
    npm pack --silent >/dev/null
  )
  local tarball
  tarball="$(ls -1 "$ROOT"/coefficient-work-mcp-doctor-*.tgz | head -n 1)"
  [[ -f "$tarball" ]] || { echo "npm pack produced no tarball" >&2; exit 2; }
  cp "$tarball" "$sandbox/mcp-doctor.tgz"
  sed "s|__MCP_DOCTOR_BLIND_MODELS__|$BLIND_MODELS|g" "$prompt_src" > "$sandbox/PROMPT.md"
  job_parts "$sandbox"
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"
  printf '%s\n' "$BLIND_MODELS" > "$STATE_DIR/models.txt"

  local plist="$STATE_DIR/$LABEL.plist"
  local launch_log="$STATE_DIR/launch.log"
  local login_command
  printf -v login_command 'exec %q %q %q %q %q' \
    "$ROOT/scripts/blind-eval-gui-runner.zsh" "$sandbox" "$STATE_DIR" "$agent_bin" "$ROOT"

  plutil -create xml1 "$plist"
  plutil -insert Label -string "$LABEL" "$plist"
  plutil -insert ProgramArguments -json "[\"/bin/zsh\",\"-lic\",$(printf '%s' "$login_command" | /usr/bin/python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')]" "$plist"
  plutil -insert RunAtLoad -bool true "$plist"
  plutil -insert ProcessType -string Interactive "$plist"
  plutil -insert StandardOutPath -string "$launch_log" "$plist"
  plutil -insert StandardErrorPath -string "$launch_log" "$plist"

  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "sandbox: $sandbox"
  echo "label: $LABEL"
  echo "status: $ROOT/scripts/blind-eval-gui.sh status $sandbox"
}

status_job() {
  local sandbox="$1"
  job_parts "$sandbox"
  echo "sandbox: $sandbox"
  if [[ -f "$STATE_DIR/provider-env.status" ]]; then
    echo "model provider environment:"
    sed 's/^/  /' "$STATE_DIR/provider-env.status"
  else
    echo "model provider environment: pending"
  fi
  if [[ -f "$sandbox/agent.exit" ]]; then
    echo "agent exit: $(cat "$sandbox/agent.exit")"
  elif launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
    echo "agent state: running"
  else
    echo "agent state: not running (no exit file)"
  fi
  [[ -f "$sandbox/REPORT.md" ]] && echo "report: $sandbox/REPORT.md"
}

cleanup_job() {
  local sandbox="$1"
  job_parts "$sandbox"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  if [[ -d "$STATE_DIR" ]]; then
    find "$STATE_DIR" -type f -delete
    rmdir "$STATE_DIR"
  fi
  echo "removed transient job: $LABEL"
  echo "sandbox retained: $sandbox"
}

command="${1:-}"
case "$command" in
  start)
    start_job "${2:-}"
    ;;
  status)
    [[ $# -eq 2 ]] || { usage >&2; exit 2; }
    status_job "$2"
    ;;
  cleanup)
    [[ $# -eq 2 ]] || { usage >&2; exit 2; }
    cleanup_job "$2"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
