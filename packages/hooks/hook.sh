#!/usr/bin/env bash
# Switchboard editor hook. Usage: hook.sh <cursor|claude> <pre|post|start>
# pre: deny an edit when `switchboard check` exits 2.
# post: record the edit. start: inject a briefing (Claude Code uses it; Cursor ignores it).
# Set SWITCHBOARD_OFF=1 to allow everything. A hook error allows the edit.
editor="${1:-cursor}"
event="${2:-pre}"
input=$(cat)
root=$(cd "$(dirname "$0")/../.." && pwd)
cli=(npx --prefix "$root" tsx "$root/packages/cli/src/index.ts")

allow() {
  if [[ "$editor" == "cursor" && "$event" == "pre" ]]; then
    echo '{"permission":"allow"}'
  else
    echo '{}'
  fi
  exit 0
}

if [[ -n "${SWITCHBOARD_OFF:-}" ]]; then
  allow
fi

# Cursor also runs .claude/settings.json. The Cursor hook already handled it.
if [[ "$editor" == "claude" ]] && printf '%s' "$input" | jq -e 'has("cursor_version")' >/dev/null 2>&1; then
  echo '{}'
  exit 0
fi

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // .file_path // ""' 2>/dev/null || true)
rel="$file"
[[ "$file" == "$root/"* ]] && rel="${file#"$root"/}"
# The demo graph stores paths inside demo-repo/, not from the outer repo root.
prefix="${SB_PREFIX-demo-repo}"
if [[ -n "$prefix" && "$rel" == "$prefix/"* ]]; then
  rel="${rel#"$prefix"/}"
fi

if [[ "$event" == "start" ]]; then
  text=$("${cli[@]}" brief --prefix "" 2>/dev/null || true)
  if [[ "$editor" == "cursor" ]]; then
    jq -nc --arg c "$text" '{additional_context:$c}'
  else
    jq -nc --arg c "$text" '{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$c}}'
  fi
  exit 0
fi

if [[ -z "$rel" || "$rel" == "null" ]]; then
  allow
fi

if [[ "$event" == "post" ]]; then
  "${cli[@]}" edited "$rel" >/dev/null 2>&1 || true
  echo '{}'
  exit 0
fi

set +e
reason=$("${cli[@]}" check "$rel" 2>/dev/null)
code=$?
set -e
if [[ "$code" -ne 2 ]]; then
  allow
fi

if [[ "$editor" == "cursor" ]]; then
  jq -nc --arg r "$reason" '{permission:"deny", user_message:$r, agent_message:$r}'
else
  jq -nc --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
fi
exit 0
