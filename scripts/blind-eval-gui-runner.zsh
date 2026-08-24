#!/bin/zsh
set -u

sandbox="$1"
state_dir="$2"
agent_bin="$3"

cd "$sandbox" || exit 90

{
  for name in OPENAI_API_KEY ANTHROPIC_API_KEY OPENROUTER_API_KEY AI_GATEWAY_API_KEY OLLAMA_HOST; do
    if [[ -n "${(P)name:-}" ]]; then
      print "$name=PRESENT"
    else
      print "$name=ABSENT"
    fi
  done
} > "$state_dir/provider-env.status"

if [[ ! -x "$agent_bin" ]]; then
  print "blind-eval GUI runner: agent executable not found: $agent_bin" > "$sandbox/agent.log"
  print 127 > "$sandbox/agent.exit"
  exit 127
fi

prompt="$(cat "$sandbox/PROMPT.md")"
"$agent_bin" -p --force --trust --workspace "$sandbox" "$prompt" > "$sandbox/agent.log" 2>&1
agent_code=$?
print "$agent_code" > "$sandbox/agent.exit"
exit "$agent_code"
