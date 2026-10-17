#!/usr/bin/env bash
# Switchboard editor hook. Usage: hook.sh <cursor|claude> <pre|post|start|end>   (JSON event on stdin)
#   pre   claim the file before an Edit/MultiEdit/Write/NotebookEdit; on a conflict, deny with the import path.
#   post  record the edit (Claude Code PostToolUse, Cursor afterFileEdit) and log it.
#   start inject a whole-repo briefing (Claude Code SessionStart, Cursor sessionStart).
#   end   release this agent's claims (Claude Code SessionEnd, Cursor sessionEnd).
# Fails open: Switchboard down, a timeout or any error allows the edit. No jq: disabled, and said so at start.
# Fast path: the HTTP server (SB_URL, default http://localhost:8787), ~20 ms. Fallback: the CLI (~1 s).
# Env: SWITCHBOARD_OFF=1 disables it. SB_AGENT overrides the agent id (default: git branch of the
# session's cwd). SB_ROOT is the agent's repo root (default: git top level of the session's cwd).
# SB_PREFIX is the parsed repo's directory inside it (default demo-repo; empty = the whole repo).
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
if ! command -v jq >/dev/null 2>&1; then
  log "jq missing, Switchboard disabled"
  if [[ "$event" == "start" ]]; then
    msg="Switchboard is disabled: jq is missing on this machine, so edits are not checked against other agents' claims."
    if [[ "$editor" == "cursor" ]]; then printf '{"additional_context":"%s"}\n' "$msg"
    else printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"; fi
    exit 0
  fi
  allow
fi
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
  if ! text=$(curl -sf --max-time 2 "$url/api/brief?prefix=" 2>/dev/null | jq -er '.text' 2>/dev/null); then
    text=$(SB_AGENT="$agent" cli brief --prefix "" 2>/dev/null)
  fi
  if [[ "$editor" == "cursor" ]]; then
    jq -nc --arg c "$text" '{additional_context:$c}'
  else
    jq -nc --arg c "$text" '{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$c}}'
  fi
  exit 0
fi

if [[ "$event" == "end" ]]; then
  # The server has no release route, so this always takes the CLI.
  out=$(cli release --agent "$agent" 2>/dev/null)
  log "end $agent: ${out:-release failed}"
  echo '{}'
  exit 0
fi

file=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // .tool_input.path // .file_path // empty' 2>/dev/null <<<"$input")
[[ -z "$file" ]] && allow
# Repo-relative to the agent's own checkout, which may not be this one.
base="${SB_ROOT:-$(git -C "${cwd:-$PWD}" rev-parse --show-toplevel 2>/dev/null || echo "$root")}"
rel="$file"
[[ "$file" == "$base/"* ]] && rel="${file#"$base"/}"
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

# pre: claim the file. The server answers {ok, conflicts, unknown}; if it is down, the CLI (exit 2 = conflict).
# Two lines per conflict: the import path, then who holds it and for how long.
LINES='.conflicts[] |
  ((.path | join(" ─imports→ ")) + (if .type == "SAME" then " (same file)" else "" end)),
  ("held by \(.agent)" + (if .taskId then " · task \(.taskId)" else "" end)
    + (if .intent then " \"\(.intent)\"" else "" end)
    + (if .until then " · free in \((.until - $now) / 60000 | round) min" else "" end))'
head="✗ Switchboard blocked this edit"
tail="Don't work around this with Bash. Pick another file or call brief_me."
reason=""
body=$(jq -nc --arg a "$agent" --arg p "$rel" '{agent:$a, paths:[$p]}')
if response=$(curl -sf --max-time 1 -H 'content-type: application/json' -d "$body" "$url/api/claims" 2>/dev/null); then
  if [[ $(jq -r '.ok' <<<"$response" 2>/dev/null) == "false" ]]; then
    lines=$(jq -r --argjson now "$(date +%s)000" "$LINES" <<<"$response" 2>/dev/null)
    reason=$(printf '%s\n%s\n%s' "$head" "$lines" "$tail")
  fi
  unknown=$(jq -r '(.unknown // [])[]' <<<"$response" 2>/dev/null)
else
  out=$(cli claim "$rel" --agent "$agent" 2>/dev/null)
  [[ $? -eq 2 ]] && reason=$(printf '%s\n%s\n%s' "$head" "$out" "$tail")
  unknown=$(sed -n 's/^WARNING not in the parsed graph, no dependency check: //p' <<<"$out")
fi

if [[ -z "$reason" ]]; then
  if [[ -n "$unknown" ]]; then
    log "allow $rel for $agent: not in the parsed graph, no dependency check"
    if [[ "$editor" == "claude" ]]; then
      jq -nc --arg m "Switchboard: $rel is not in the parsed graph, no dependency check" '{systemMessage:$m}'
      exit 0
    fi
  else
    log "allow $rel for $agent (claimed)"
  fi
  allow
fi
log "deny $rel for $agent: ${reason//$'\n'/ | }"
if [[ "$editor" == "cursor" ]]; then
  jq -nc --arg r "$reason" '{permission:"deny", user_message:$r, agent_message:$r}'
else
  jq -nc --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse", permissionDecision:"deny", permissionDecisionReason:$r}}'
fi
exit 0
