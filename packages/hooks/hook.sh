#!/usr/bin/env bash
# Switchboard editor hook. Usage: hook.sh <cursor|claude> <pre|post|start>   (JSON event on stdin)
#   pre   deny an Edit/Write that collides with another agent's claim; the reason is the import path.
#   post  record the edit (Claude Code PostToolUse, Cursor afterFileEdit) and log it.
#   start inject a briefing (Claude Code SessionStart, Cursor sessionStart).
# Fails open: no jq, Switchboard down, a timeout or any error allows the edit.
# Fast path: the HTTP server (SB_URL, default http://localhost:8787), ~20 ms. Fallback: the CLI (~1 s).
# Env: SWITCHBOARD_OFF=1 disables it. SB_AGENT overrides the agent id (default: git branch of the
# session's cwd). SB_PREFIX is the parsed repo's directory (default demo-repo; empty = whole checkout).
# SB_HOOK_TIMEOUT caps the CLI fallback in seconds (default 3). SB_HOOK_LOG is the log file.
editor="${1:-cursor}"
event="${2:-pre}"
root=$(cd "$(dirname "$0")/../.." && pwd)
url="${SB_URL:-http://localhost:${SERVER_PORT:-8787}}"
limit="${SB_HOOK_TIMEOUT:-3}"
logfile="${SB_HOOK_LOG:-${TMPDIR:-/tmp}/switchboard-hook.log}"

allow() {
  if [[ "$editor" == "cursor" && "$event" == "pre" ]]; then echo '{"permission":"allow"}'; else echo '{}'; fi
  exit 0
}

log() { printf '%s %s %s %s\n' "$(date -u +%FT%TZ)" "$editor" "$event" "$*" >>"$logfile" 2>/dev/null || true; }

# Run the CLI, killed after $limit seconds. The watcher's output goes to /dev/null so $(...) does not wait for it.
cli() {
  "$root/node_modules/.bin/tsx" "$root/packages/cli/src/index.ts" "$@" &
  local pid=$!
  (sleep "$limit"; kill "$pid") >/dev/null 2>&1 &
  local watcher=$!
  wait "$pid"
  local code=$?
  kill "$watcher" >/dev/null 2>&1
  return "$code"
}

[[ -n "${SWITCHBOARD_OFF:-}" && "${SWITCHBOARD_OFF}" != "0" ]] && allow
command -v jq >/dev/null 2>&1 || allow
input=$(cat)

# Cursor also runs .claude/settings.json; the Cursor hook already handled the event.
if [[ "$editor" == "claude" ]] && jq -e 'has("cursor_version")' >/dev/null 2>&1 <<<"$input"; then
  echo '{}'
  exit 0
fi

cwd=$(jq -r '.cwd // empty' 2>/dev/null <<<"$input")
agent="${SB_AGENT:-$(git -C "${cwd:-$PWD}" rev-parse --abbrev-ref HEAD 2>/dev/null)}"
agent="${agent:-unknown}"

if [[ "$event" == "start" ]]; then
  text=$(SB_AGENT="$agent" cli brief --prefix "" 2>/dev/null)
  if [[ "$editor" == "cursor" ]]; then
    jq -nc --arg c "$text" '{additional_context:$c}'
  else
    jq -nc --arg c "$text" '{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$c}}'
  fi
  exit 0
fi

file=$(jq -r '.tool_input.file_path // .tool_input.path // .file_path // empty' 2>/dev/null <<<"$input")
[[ -z "$file" ]] && allow
rel="$file"
[[ "$file" == "$root/"* ]] && rel="${file#"$root"/}"
# Only files inside the parsed repo are checked or recorded, so this checkout's own source never lands in the graph.
prefix="${SB_PREFIX-demo-repo}"
if [[ -n "$prefix" ]]; then
  [[ "$rel" == "$prefix/"* ]] || allow
  rel="${rel#"$prefix"/}"
fi

if [[ "$event" == "post" ]]; then
  body=$(jq -nc --arg a "$agent" --arg p "$rel" '{agent:$a, path:$p}')
  if curl -sf --max-time 1 -H 'content-type: application/json' -d "$body" "$url/api/edits" >/dev/null 2>&1; then
    log "edit $rel by $agent (http)"
  else
    # Detached so the editor is not kept waiting on the slow path.
    (cli edited "$rel" --agent "$agent" >/dev/null 2>&1 &)
    log "edit $rel by $agent (cli)"
  fi
  echo '{}'
  exit 0
fi

# pre: ask the server; if it is down, ask the CLI (exit 2 = conflict); anything else allows.
reason=""
if response=$(curl -sf --max-time 1 -G --data-urlencode "path=$rel" --data-urlencode "agent=$agent" "$url/api/check" 2>/dev/null); then
  reason=$(jq -r '.conflicts[] | "CONFLICT \(.type) \(.file) ← \(.agent) via \(.path | join(" → "))"' 2>/dev/null <<<"$response")
else
  out=$(cli check "$rel" --agent "$agent" 2>/dev/null)
  [[ $? -eq 2 ]] && reason="$out"
fi

if [[ -z "$reason" ]]; then
  log "allow $rel for $agent"
  allow
fi
log "deny $rel for $agent: $reason"
if [[ "$editor" == "cursor" ]]; then
  jq -nc --arg r "$reason" '{permission:"deny", user_message:$r, agent_message:$r}'
else
  jq -nc --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
fi
exit 0
