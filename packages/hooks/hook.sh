#!/usr/bin/env bash
# Switchboard editor hook for a from-source checkout. Usage: hook.sh <claude|cursor> <start|pre|post|notify|end>
# (JSON event on stdin). A thin wrapper: the hook itself is packages/hooks/src/hook.ts (`switchboard hook`),
# which needs no jq. See that file for what each phase does. It fails open on any error.
# This wrapper only fills the from-source defaults:
#   SB_PREFIX  the parsed repo's directory inside the checkout (default demo-repo; empty = the whole repo).
#   SB_GRAPH   the graph of the dashboard at SB_URL (default http://localhost:8787) when it answers, else sb_demo.
#              When that dashboard serves SB_GRAPH, edits are posted to it so it re-parses them live.
root=$(cd "$(dirname "$0")/../.." && pwd)
url="${SB_URL:-http://localhost:${SERVER_PORT:-8787}}"
export SB_PREFIX="${SB_PREFIX-demo-repo}"

served=$(curl -sf --max-time 1 "$url/api/health" 2>/dev/null | sed -n 's/.*"graph":"\([^"]*\)".*/\1/p')
export SB_GRAPH="${SB_GRAPH:-${served:-sb_demo}}"
[[ -n "$served" && "$served" == "$SB_GRAPH" ]] && export SB_EDIT_URL="$url"

exec "$root/node_modules/.bin/tsx" "$root/packages/hooks/src/hook.ts" "${1:-cursor}" "${2:-pre}"
