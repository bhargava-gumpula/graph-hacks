#!/usr/bin/env bash
# A real Claude Code session against the hook. Agent A holds auth/session.ts; a headless
# claude (haiku) then edits ui/LoginForm.tsx (2 import hops from it: must be DENY) and
# ui/AboutPage.tsx (no path: must be ALLOW). Use the same SB_GRAPH and SERVER_PORT as your server.
# --strict-mcp-config hides the Switchboard MCP tools, so the agent just edits and the hook must stop it.
cd "$(dirname "$0")/.." || exit 1
trap 'git checkout -- demo-repo; npm run -s switchboard -- release --agent A >/dev/null' EXIT
npm run -s switchboard -- claim auth/session.ts --agent A --task T1 --intent "session ttl"
for f in ui/LoginForm.tsx ui/AboutPage.tsx; do
  start=$SECONDS
  out=$(claude -p "Use the Edit tool to add '// hi' as line 1 of demo-repo/$f; if blocked, quote the reason" \
    --model haiku --permission-mode acceptEdits --allowedTools Read,Edit --max-turns 5 --strict-mcp-config </dev/null 2>&1)
  if git diff --quiet -- "demo-repo/$f"; then verdict=DENY; else verdict=ALLOW; fi
  echo "$verdict $f ($((SECONDS - start)) s)"
  sed 's/^/  /' <<<"$out" | head -8
done
