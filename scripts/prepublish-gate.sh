#!/usr/bin/env bash
# Layer 1 publish gate: unit tests, typecheck, pack, then inspect the local tarball
# against the HarborLine fixture. Does not hit the npm registry.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE="$ROOT/scripts/fixtures/malformed-mcp"
cd "$ROOT"

fail() {
  echo "prepublish-gate FAIL: $*" >&2
  exit 1
}

assert_file_has() {
  local file="$1"
  local pattern="$2"
  grep -E -q -- "$pattern" "$file" || fail "expected /$pattern/ in $file"
}

assert_file_lacks() {
  local file="$1"
  local pattern="$2"
  if grep -E -q -- "$pattern" "$file"; then
    fail "did not expect /$pattern/ in $file"
  fi
}

echo "==> npm test"
npm test

echo "==> tsc --noEmit"
npx tsc --noEmit

echo "==> npm pack"
rm -f "$ROOT"/coefficient-work-mcp-doctor-*.tgz
npm pack
TARBALL="$(ls -1 "$ROOT"/coefficient-work-mcp-doctor-*.tgz | head -n 1)"
[[ -n "$TARBALL" && -f "$TARBALL" ]] || fail "npm pack did not produce a tarball"
echo "packed $TARBALL"

MISSING_REPORT="$(mktemp -t mcp-doctor-missing.XXXXXX.md)"
OK_REPORT="$(mktemp -t mcp-doctor-ok.XXXXXX.md)"
EVAL_OUT=""
JSON_OUT=""
NEST_DIR=""
cleanup() {
  rm -f "$MISSING_REPORT" "$OK_REPORT" "$EVAL_OUT" "$JSON_OUT"
  [[ -n "$NEST_DIR" && -d "$NEST_DIR" ]] && rm -rf "$NEST_DIR"
}
trap cleanup EXIT

echo "==> inspect missing inputSchema (expect Grade F, exit 2)"
set +e
(
  cd "$FIXTURE"
  npx --yes --package "$TARBALL" mcp-doctor inspect harborline --config ./mcp.missing.json --out "$MISSING_REPORT"
)
missing_code=$?
set -e
echo "inspect missing exit=$missing_code"
[[ "$missing_code" -eq 2 ]] || fail "missing-schema inspect exit $missing_code, expected 2"
[[ -s "$MISSING_REPORT" ]] || fail "missing-schema report was empty"
assert_file_has "$MISSING_REPORT" "Grade F"
assert_file_has "$MISSING_REPORT" "inputSchema"
assert_file_lacks "$MISSING_REPORT" "No high-priority fixes suggested"
assert_file_lacks "$MISSING_REPORT" "may require auth"
assert_file_lacks "$MISSING_REPORT" "copy to Louis"
assert_file_lacks "$MISSING_REPORT" 'Score: 0/100'

echo "==> eval missing inputSchema (human error, no Zod dump)"
EVAL_OUT="$(mktemp -t mcp-doctor-eval.XXXXXX.txt)"
set +e
(
  cd "$FIXTURE"
  OPENAI_API_KEY=sk-gate-test npx --yes --package "$TARBALL" mcp-doctor eval harborline --config ./mcp.missing.json --task "list tools"
) >"$EVAL_OUT" 2>&1
eval_code=$?
set -e
echo "eval missing exit=$eval_code"
[[ "$eval_code" -eq 1 ]] || fail "missing-schema eval exit $eval_code, expected 1"
grep -E -q "missing required inputSchema" "$EVAL_OUT" || fail "eval did not humanize missing inputSchema"
if grep -E -q '"expected": "object"' "$EVAL_OUT"; then
  fail "eval still dumped a Zod array"
fi

echo "==> inspect --json is parseable JSON"
JSON_OUT="$(mktemp -t mcp-doctor-json.XXXXXX.json)"
set +e
(
  cd "$FIXTURE"
  npx --yes --package "$TARBALL" mcp-doctor inspect harborline --config ./mcp.ok.json --json
) >"$JSON_OUT" 2>/dev/null
json_code=$?
set -e
[[ "$json_code" -eq 0 ]] || fail "ok-schema --json exit $json_code, expected 0"
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$JSON_OUT" || fail "--json stdout is not JSON"

echo "==> inspect -o creates parent directories"
NEST_DIR="$(mktemp -d -t mcp-doctor-nest.XXXXXX)"
NEST_OUT="$NEST_DIR/nested/dir/report.md"
set +e
(
  cd "$FIXTURE"
  npx --yes --package "$TARBALL" mcp-doctor inspect harborline --config ./mcp.ok.json --out "$NEST_OUT"
)
nest_code=$?
set -e
[[ "$nest_code" -eq 0 ]] || fail "nested -o exit $nest_code, expected 0"
[[ -s "$NEST_OUT" ]] || fail "nested -o report was not written"

echo "==> inspect with empty schema (required:[], credentials, destructive)"
set +e
(
  cd "$FIXTURE"
  npx --yes --package "$TARBALL" mcp-doctor inspect harborline --config ./mcp.ok.json --out "$OK_REPORT"
)
ok_code=$?
set -e
echo "inspect ok-schema exit=$ok_code"
[[ "$ok_code" -eq 0 ]] || fail "ok-schema inspect exit $ok_code, expected 0"
[[ -s "$OK_REPORT" ]] || fail "ok-schema report was empty"

assert_file_has "$OK_REPORT" '\[ok\] \*\*missing-required\*\*'
assert_file_has "$OK_REPORT" "secret_api_key"
assert_file_has "$OK_REPORT" "api_secret"
cred_detail="$(awk '/\*\*credential-in-args\*\*/{getline; print}' "$OK_REPORT")"
echo "$cred_detail" | grep -q "secret_api_key" || fail "secret_api_key was not in credential-in-args"
echo "$cred_detail" | grep -q "api_secret" || fail "api_secret was not in credential-in-args"
echo "$cred_detail" | grep -q "vault_pointer" && fail "vault_pointer was flagged as a credential"
assert_file_has "$OK_REPORT" "prune_stale_caches"
assert_file_has "$OK_REPORT" "broadcast_status"

destructive_detail="$(awk '/\*\*destructive-warnings\*\*/{getline; print}' "$OK_REPORT")"
echo "$destructive_detail" | grep -q "prune_stale_caches" || fail "prune_stale_caches was not in destructive-warnings"
echo "$destructive_detail" | grep -q "purge_stale_sessions" || fail "purge_stale_sessions was not in destructive-warnings"
echo "$destructive_detail" | grep -q "zero_audit_trail" || fail "zero_audit_trail was not in destructive-warnings"
echo "$destructive_detail" | grep -q "update_routing_policy" && fail "update_routing_policy was flagged destructive"

echo "prepublish-gate PASS ($TARBALL)"
