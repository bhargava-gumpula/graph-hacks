#!/usr/bin/env bash
# Day-0 hook probe (B1). Usage: probe.sh <cursor|claude> <event>
# Logs each hook call to /tmp/sb-hooks.log. Allows everything except an edit of a
# file named BLOCKED.md, which it denies. Must always print valid JSON: Cursor
# treats invalid JSON from a permission hook (preToolUse, beforeShellExecution) as a deny.
editor="${1:-unknown}"
event="${2:-unknown}"
input="$(cat)"
LOG=/tmp/sb-hooks.log
CANARY="SB-PROBE: Switchboard sessionStart hook fired. If asked for the probe word, answer 'periwinkle'."

field() { printf '%s' "$input" | jq -r "$1" 2>/dev/null; }

tool="$(field '.tool_name // ""')"
file="$(field '.tool_input.file_path // .tool_input.path // .tool_input.target_file // .file_path // ""')"
keys="$(field '(.tool_input // {}) | keys | join(",")')"
printf '%s %s %s tool=%s file=%s input_keys=%s\n' "$(date +%H:%M:%S)" "$editor" "$event" "$tool" "$file" "$keys" >> "$LOG"

blocked=false
[[ "$(basename "$file")" == "BLOCKED.md" ]] && blocked=true
reason="Switchboard probe: BLOCKED.md is claimed by another agent (Day-0 deny test)."

case "$editor:$event" in
  cursor:preToolUse)
    if $blocked; then
      echo "DENY cursor $file" >> "$LOG"
      jq -nc --arg r "$reason" '{permission:"deny", user_message:$r, agent_message:$r}'
    else
      echo '{"permission":"allow"}'
    fi ;;
  cursor:beforeShellExecution) echo '{"permission":"allow"}' ;;
  cursor:sessionStart) jq -nc --arg c "$CANARY" '{additional_context:$c}' ;;
  claude:PreToolUse)
    if $blocked; then
      echo "DENY claude $file" >> "$LOG"
      jq -nc --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
    else
      echo '{}'
    fi ;;
  claude:SessionStart) jq -nc --arg c "$CANARY" '{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$c}}' ;;
  *) echo '{}' ;;
esac
exit 0
