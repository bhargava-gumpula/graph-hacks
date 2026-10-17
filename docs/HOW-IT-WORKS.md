# How it works: Claude Code and Cursor on one repo

Switchboard sits in each editor's hooks. Before an agent changes a file, its hook asks a shared FalkorDB graph
whether another agent holds that file or a file within 3 imports of it. The first claim wins. The second agent
is refused with the import path, waits, and is told when the file is free. The agent that holds the file is told
that someone waits.

Every message below is the exact text an agent sees. They come from a real run with crafted hook events against
the demo repo (`demo-repo/`), where `ui/LoginForm.tsx` imports `api/login.ts`, which imports `auth/session.ts`.

## Who is who

Each editor gets its own agent id: `<editor>@<branch>`. On branch `main`, Claude Code is `claude@main` and Cursor
is `cursor@main`, so two editors on one checkout are two agents and can conflict. The hooks, the MCP server and the
CLI all use the same id (the MCP configs pass `SB_EDITOR`). `SB_AGENT` overrides it. Two Claude Code sessions on
one branch share `claude@main`; give one its own worktree or set `SB_AGENT`.

## The story

**1. Claude Code edits `auth/session.ts` first.** Its `PreToolUse` hook claims the file for 30 minutes (every
further edit renews it). The edit goes ahead and the agent sees nothing.

**2. Cursor tries `ui/LoginForm.tsx`.** Its `preToolUse` hook finds Claude Code's claim two imports away and
refuses the edit. Cursor's agent reads:

```
✗ Switchboard blocked this edit
ui/LoginForm.tsx ─imports→ api/login.ts ─imports→ auth/session.ts
held by claude@main · free in 30 min
Don't work around this with Bash. Pick another file or call brief_me.
You are now waiting on auth/session.ts; Switchboard tells you here when it is free.
```

The graph now has `(cursor@main)-[:WAITS_FOR]->(auth/session.ts)` and a `wait` event. Cursor can pick a file that
does not touch that path (a refusal lists `Safe now:` files when open tasks have some), or wait.

**3. Claude Code hears that someone waits.** On its next hook call (any edit, or any Bash command), it reads:

```
cursor@main is waiting on auth/session.ts: it wants ui/LoginForm.tsx, 2 imports from your claim. Release it when you're done: switchboard release auth/session.ts --agent claude@main
```

It is told once per wait. Claude Code is never blocked by this: the first claim wins.

**4. The file is freed.** Any of these frees it: Claude Code's session ends (`SessionEnd` releases its claims),
it runs `switchboard release` (or the MCP `release` tool), or the claim expires after 30 minutes without an edit.
A release records a `free` event. An expiry is noticed on the waiter's next hook call, and the `free` event is
recorded then.

**5. Cursor hears the file is free.** On its next hook call it reads:

```
auth/session.ts is free now; you can retry ui/LoginForm.tsx.
```

Its `WAITS_FOR` edge is removed. The retry is claimed and allowed.

## Shell commands

Claude Code's `Bash` tool and Cursor's shell are checked too. Before a command runs, the hook reads the obvious
write targets: `>` and `>>` redirections, `tee`, `sed -i`, `mv`, `cp` (the target), `rm`, `touch` and
`git checkout -- <file>`. Those files are claimed exactly like an edit, so `sed -i '' 's/a/b/' auth/session.ts` is
refused while Cursor holds `ui/LoginForm.tsx`. Anything unclear (globs, variables, `$(...)`, a `cd` first) is left
out, a read-only command (`cat`, `grep`, `git diff`) never yields a file, and a parse failure allows the command.

After the command, the hook compares `git status` with what it saw before and records an edit for each file that
changed, whatever the command was (`npm run format`, a code generator).

## Advice instead of blocks

Set `SB_MODE=warn` and every edit goes ahead. The refusal text is passed to the agent as context instead, with a
first line of `⚠ Switchboard warning (SB_MODE=warn, the edit goes ahead)`, and nobody waits. The default is to
block (`enforce`).

## What each editor can show

| Moment | Claude Code | Cursor |
| --- | --- | --- |
| Refusal | `PreToolUse` → `hookSpecificOutput.permissionDecision: "deny"` with `permissionDecisionReason`, shown to Claude | `preToolUse` (`Write`, `Delete`) or `beforeShellExecution` → `permission: "deny"`, `user_message`, `agent_message` |
| "Someone waits" and "free now" | `hookSpecificOutput.additionalContext` on the next `PreToolUse` or `PostToolUse` | `additional_context` on the next `postToolUse` (`Write`, `Shell`). Cursor's `preToolUse` documents `agent_message` for denials only, so notices wait for `postToolUse` |
| Warn mode | `additionalContext` on `PreToolUse`, no decision | `permission: "allow"` with `agent_message` (Cursor documents `agent_message` for denials, so it may not reach the agent) |
| Edit recorded | `PostToolUse` (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `Bash`) | `afterFileEdit`, `afterShellExecution` |
| Session | `SessionStart` brief in `additionalContext`; `SessionEnd` releases | `sessionStart` brief in `additional_context`; `sessionEnd` releases |

## In the graph

```
(:Agent)-[:CLAIMS {since, until, ttl}]->(:File)
(:Agent)-[:WAITS_FOR {since, path, holder, via}]->(:File)     the file the holder claims; `path` is the file the waiter wanted
(:Event {kind: 'conflict'})-[:VIA]->(:File)                    every file on the refused import path
(:Event {kind: 'wait', payload: {agent, path, holder, via}})   `path` is the held file
(:Event {kind: 'free', payload: {path, waiters}})
```

## Try it

```bash
cp -R demo-repo /tmp/sb-demo && cd /tmp/sb-demo && git init -q -b main && git add -A && git commit -qm init && cd -
SB_GRAPH=sb_try npm run switchboard -- parse /tmp/sb-demo
ev() { printf '{"cwd":"/tmp/sb-demo","tool_name":"%s","tool_input":{"file_path":"/tmp/sb-demo/%s"}}' "$1" "$2"; }
export SB_GRAPH=sb_try SB_PREFIX=
ev Edit auth/session.ts | packages/hooks/hook.sh claude pre        # {} : claimed
ev Write ui/LoginForm.tsx | packages/hooks/hook.sh cursor pre      # permission deny, with the path
ev Edit auth/session.ts | packages/hooks/hook.sh claude post       # additionalContext: cursor@main is waiting ...
echo '{"cwd":"/tmp/sb-demo"}' | packages/hooks/hook.sh claude end  # releases, records `free`
ev Write ui/AboutPage.tsx | packages/hooks/hook.sh cursor notify   # additional_context: ... is free now
ev Write ui/LoginForm.tsx | packages/hooks/hook.sh cursor pre      # permission allow
```

## Sources (checked 2026-10-17)

- Claude Code hooks reference, PreToolUse and PostToolUse decision control (`permissionDecision`,
  `permissionDecisionReason`, `additionalContext`): https://code.claude.com/docs/en/hooks
- Cursor hooks (events, `permission`, `user_message`, `agent_message`, `additional_context`, matchers `Write`,
  `Delete`, `Shell`, `beforeShellExecution`, `afterShellExecution`): https://cursor.com/docs/agent/hooks
