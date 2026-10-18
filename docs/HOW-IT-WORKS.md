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
CLI all use the same id (the MCP configs pass `SB_EDITOR`). `SB_AGENT` overrides it.

Two sessions in the same editor on one branch are two agents too. The first session takes `claude@main`. While it
is live, a second one gets `claude@main#<first 4 characters of its session id>`, for example `claude@main#3f9c`.
The graph records which session holds an id (`Agent.session`), and taking it is one atomic write, so two sessions
starting at once cannot both win. A session that ends (`SessionEnd`) releases only its own claims and frees the
id. A holder that has been silent for 30 minutes counts as gone. Cursor uses its `conversation_id` the same way.
The MCP server still answers as `<editor>@<branch>`.

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

**3. Claude Code hears that someone waits.** On its next hook call (any edit, or any Bash command that may
write), it reads:

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
Only targets worth a lock are claimed: files the parser loaded and files git tracks (`README.md`, `package.json`).
Build output, logs and folders (`rm -rf dist`, `npm test > test.log 2>&1`, `rm -rf node_modules`) are not: they
are usually gitignored, and the same name in another worktree is another file, so two agents in two worktrees can
both run them.

A command that surely only reads is skipped before anything else runs: no `git status`, no FalkorDB connection.
Every part of it must be a known reader (`ls`, `cat`, `grep`, `rg`, `head`, `sed -n`, `find` without `-delete` or
`-exec`, `git status`, `git diff`, `git log` and the like) with no redirection to a file. Anything else, including
`npm test`, `$(...)`, `&`, loops and heredocs, goes through the full check.

After the command, the hook compares `git status` with what it saw before and records an edit for each file that
changed, whatever the command was (`npm run format`, a code generator). Claude Code and Cursor share one checkout,
so that diff also shows the other editor's work while the command ran. A changed file another agent claims, or
edited after the command started, is theirs: it is left out, so a long `npm test` in Claude Code never turns
Cursor's edit to `ui/Footer.tsx` into an edit (and a collision) by `claude@main`.

## Files outside the parsed graph

The parser reads TypeScript and JavaScript. A `README.md`, `package.json`, a `.css` or a `.py` file has no imports
to follow, but it still gets a plain file lock. Its claim creates `(:File {path, unparsed: true})`, and only
another agent's edit of the very same file conflicts with it. The refusal says so:

```
✗ Switchboard blocked this edit
README.md (same file; not in the parsed graph, so only the same file is checked)
held by claude@main · free in 30 min
```

The agent that claims such a file is told once per session (a `systemMessage`): `Switchboard: README.md is not in
the parsed graph: claimed, but only an edit of the same file conflicts (no import check)`. A new `.ts` file is
claimed the same way until its first save is parsed, with no note. A parse never deletes an unparsed node, because
only parsed files have a hash.

## Keeping the graph current

The hooks never re-parse the whole repo and never replace the graph.

- **After each edit** (`PostToolUse`, and every file a shell command changed), each edited file is re-read alone
  with core `updateFile`: its node, and the import edges it gained or lost. The plugin has no parser in its hook
  bundle, so it hands the files to a detached `switchboard parse <dir> --update <files>`; the editor does not
  wait for it. A file the agent deleted loses its node, and nothing else is deleted.
- **At session start** the hook makes the cheap check: it hashes the checkout's source files (`git ls-files`, no
  parser, one query) against the hashes in the graph. Only new or changed files are re-read, in the background.
  Files someone claims are skipped, because the agent editing one may be in another worktree whose newer version
  the graph already holds. When the graph has no parsed file at all, the first load runs in the background.
  It adds and updates files and deletes nothing.

### Worktrees

Every worktree of a repo shares one graph (`sb_<main checkout name>`). Two worktrees on different branches have
different files, so the hooks only ever add and update. A new file in worktree Y keeps its node, its claims and its
import edges whatever worktree X edits or loads. When a file differs between two worktrees, the graph holds the
version from the last edit of it.

Only an explicit `switchboard parse <dir>` replaces the graph and deletes the files it does not find. Run it from
the main checkout, for example after a merge or a branch switch there, and not from a worktree with files the
others need.

### What a hook call costs

Measured 2026-10-17 on the owner's Mac (Node 26, local FalkorDB in Docker). Each figure is the median of 20 calls
of the plugin's `dist/hook.mjs` with a crafted Claude Code event, the old build (`7960829`) and the new one
interleaved call by call so machine noise hits both alike. Each call includes starting Node, which costs about
100 ms before any Switchboard code runs. "Big repo" is a `git archive` export of a Next.js app with 579 source files.

| Hook call | demo-repo, before | demo-repo, after | big repo, before | big repo, after |
| --- | ---: | ---: | ---: | ---: |
| `Edit` PreToolUse (claim) | 202 ms | 165 ms | 308 ms | 242 ms |
| `Edit` PostToolUse (record, start the file's update) | 198 ms | 166 ms | 294 ms | 241 ms |
| `Bash` `ls -la`, PreToolUse | 237 ms | 121 ms | 386 ms | 188 ms |
| `Bash` `ls -la`, PostToolUse | 259 ms | 128 ms | 407 ms | 173 ms |
| `Bash` `npm test`, PreToolUse (git status) | 242 ms | 202 ms | 374 ms | 302 ms |
| `Bash` `npm test`, PostToolUse (git status diff) | 236 ms | 163 ms | 410 ms | 260 ms |
| `SessionStart` (median of 10, two rounds) | 234–322 ms | 215–248 ms | 357–359 ms | 376–381 ms |

Where the time went: the hook used to run three `git` commands before doing anything (about 20 ms each here;
now one), nine schema statements on every call (now one read, at session start only), and a `git status` for
`ls`. The big-repo rows are slower on both builds mostly because the old build's background parses ran during
the run. `SessionStart` on the big repo is about 20 ms slower: it now hashes 564 source files to find changed
ones, instead of starting a full parse.

The work the editor does not wait for changed more. The old hook started a full parse of the repo at most every
20 seconds: 1.9–2.1 s and 430 MB per run on the big repo. The new one starts `parse --update <file>` per edit:
0.5 s and 230 MB, almost all of it loading the parser. A session start with nothing changed starts nothing.

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
