#!/bin/zsh
set -u

sandbox="$1"
state_dir="$2"
agent_bin="$3"
repo_root="$4"

cd "$sandbox" || exit 90

if ! node "$0:A:h/provider-env-status.mjs" > "$state_dir/provider-env.status" 2>&1; then
  print "blind-eval GUI runner: invalid credential configuration; see provider-env.status" > "$sandbox/agent.log"
  print 78 > "$sandbox/agent.exit"
  exit 78
fi

if [[ ! -x "$agent_bin" ]]; then
  print "blind-eval GUI runner: agent executable not found: $agent_bin" > "$sandbox/agent.log"
  print 127 > "$sandbox/agent.exit"
  exit 127
fi

prompt="$(cat "$sandbox/PROMPT.md")"
"$agent_bin" -p --force --trust --workspace "$sandbox" "$prompt" > "$sandbox/agent.log" 2>&1
agent_code=$?
if [[ "$agent_code" -eq 0 && -f "$sandbox/REPORT.md" ]]; then
  models="$(cat "$state_dir/models.txt")"
  print "$(node -p "require('$repo_root/package.json').version")" > "$sandbox/package-version.txt"
  print "MCP_DOCTOR_BLIND_MODELS=$models npm run blind-eval:gui" > "$sandbox/invocation.txt"
  node "$repo_root/scripts/validate-blind-artifacts.mjs" "$sandbox" "$models" >> "$sandbox/agent.log" 2>&1
  agent_code=$?
fi
print "$agent_code" > "$sandbox/agent.exit"
exit "$agent_code"
