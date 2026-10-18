# Live demo: Claude Code and Cursor on one repo, graph in FalkorDB Cloud

Claude Code (terminal) and Cursor (desktop app) open the same small TypeScript app. Claude Code changes
`auth/session.ts`. Cursor is asked to change `ui/LoginForm.tsx`, a different file, but `LoginForm` imports
`api/login.ts`, which imports `auth/session.ts`. Switchboard refuses Cursor's edit and names that path, records
that Cursor is waiting, tells Claude someone is waiting, and tells Cursor when the file is free. The dashboard
shows each claim, refusal, wait and free as it happens, read from FalkorDB Cloud.

Commands run from the Switchboard checkout. Paths below use `~/switchboard-demo`, the demo repo.

## Once: set up

```bash
npm run demo:setup
```

It makes `~/switchboard-demo`, a git copy of `demo-repo` (35 files: a notes app with login, sessions and settings),
wires both editors (Claude Code hooks in the git-ignored `.claude/settings.local.json`, Cursor hooks in
`.cursor/hooks.json`, the MCP server in `.mcp.json` and `.cursor/mcp.json`), commits that as `demo-start`, and
parses it into graph `sb_demo_live` on FalkorDB Cloud. Running it again starts over (it only ever replaces a
folder it made). The hook commands hold this checkout's absolute path: if you merge this branch and delete the
worktree, run `npm run demo:setup` again from the checkout you will demo from.

**After merging, rebuild the dashboard** in the checkout you will demo from, next to re-running setup:

```bash
npm run build -w @switchboard/web   # the live-graph dashboard UI; demo:start refuses a dist older than apps/web/src
npm run demo:setup
```

The public server on 127.0.0.1:8788 (switchboard-agents.xyz) serves the same `graph-hacks/apps/web/dist`, so
rebuilding in graph-hacks also updates the public site at once. That is an integration/owner decision: make it
before you rebuild there.

Optional: `npm run demo:setup -- --allow-mcp` also adds `"permissions": {"allow": ["mcp__switchboard"]}` to the
demo repo's git-ignored `.claude/settings.local.json`, so Claude Code calls the Switchboard MCP tools (`claim`,
`release`, `brief_me`) without asking. Default is off: then Claude Code asks once per tool, and you approve on camera.
It changes nothing else and only in `~/switchboard-demo`.

**One folder for both editors.** Both open `~/switchboard-demo`: two agents writing files on one disk, which is
the case Switchboard is for. They are still two agents (`claude@main`, `cursor@main`). The dashboard's server
re-parses each edited file from this folder, so every edit updates the graph in FalkorDB Cloud.

**No password in the demo repo.** Each hook and MCP config carries `SB_ENV_FILE=<graph-hacks>/.env` and `SB_CLOUD=1`;
the password stays in that git-ignored file and is read at run time.

## Before each take (2 commands, 2 windows)

```bash
npm run demo:reset                 # repo back to demo-start; no agents, claims, waits or events
npm run demo:start -- --no-open    # dashboard on port 8790 (skip if it is already running)
```

1. Open http://localhost:8790/app (or the installed app: in Chrome, the install icon in the address bar, once).
   The header reads `Live graph · switchboard-demo · 35 files · FalkorDB Cloud`. If the page was open, reload it
   (Cmd+R). There is no Play button on a live graph: the agents are real.
2. **Claude Code**, in a terminal: `cd ~/switchboard-demo && claude`. Trust the folder if asked. Press Shift+Tab
   once for "accept edits on", so file edits do not stop for approval.
3. **Cursor**: `cursor ~/switchboard-demo` and open a new Agent chat. If Cursor asks to trust the folder or enable
   its hooks, say yes.
4. Arrange: terminal left, Cursor right, dashboard on top or on a second screen.

**During the take, say No to shell commands that write files.** If either agent asks to run something like
`python3 - <<'EOF' ...`, `cat > file`, `sed -i` or `node -e` to change code, deny it (Esc in Claude Code, Skip in
Cursor). The hooks check the editors' edit tools and a list of shell write patterns; a script written into a
heredoc can slip past that list. With "accept edits on", Claude's normal edits never ask, so any shell prompt you
see is one to read.

## The take: two files, one import path (deterministic)

**1. Paste into Claude Code:**

```
In auth/session.ts, add an expiresAt field to OpenSession, set to 30 minutes after openedAt. Only change auth/session.ts.
```

Wait until the dashboard shows `Claude Code · main claimed auth/session.ts` (the Agents panel lists the file with a
30-minute countdown). Claude Code keeps that claim while its session is open.

**2. Paste into Cursor:**

```
In ui/LoginForm.tsx, add rememberMe: false to what loginFields returns. Only change ui/LoginForm.tsx.
```

Cursor's write is blocked. Its agent reads:

```
✗ Switchboard blocked this edit
ui/LoginForm.tsx ─imports→ api/login.ts ─imports→ auth/session.ts
held by claude@main · free in 30 min
Don't work around this with Bash. Pick another file or call brief_me.
You are now waiting on auth/session.ts; Switchboard tells you here when it is free.
```

Dashboard: `Collisions prevented` goes to 1; the feed shows `Cursor · main refused: ui/LoginForm.tsx reaches
auth/session.ts (Claude Code · main) in 2 hops` and `Cursor · main is waiting for auth/session.ts, held by Claude
Code · main`; the Agents panel shows Cursor `waiting`; the graph lights LoginForm → login → session.

**3. Paste into Claude Code:**

```
Also add an isExpired(session: OpenSession, now: Date) helper to auth/session.ts.
```

Its edit hook tells it: `cursor@main is waiting on auth/session.ts: it wants ui/LoginForm.tsx, 2 imports from your
claim. When you're done with it, release it: call the switchboard MCP tool release ...`. Claude makes the edit and
usually says Cursor is waiting; it may call the `release` tool (approve it, unless you set up with `--allow-mcp`).
If it does not release, type `/exit`: ending the session releases every claim.

Dashboard: `Claude Code · main released ...` and `auth/session.ts is free: Cursor · main can go`; Cursor's card
shows `can go`.

**4. Type into Cursor:** `try again`. Its next tool use reads `auth/session.ts is free now; you can retry
ui/LoginForm.tsx.` and the edit goes through: `Cursor · main claimed ui/LoginForm.tsx`, `... edited ...`.

### If Cursor is not refused (fallback that always works)

Cursor's hooks are the part not yet run with the Cursor app itself (see "Tested"). If step 2 shows no block and
`npm run demo:log` has no `cursor` line, play Cursor's side from a terminal instead:

```bash
npm run demo:cursor -- ui/LoginForm.tsx
```

It sends a Cursor-shaped Write of that file through the exact commands in `~/switchboard-demo/.cursor/hooks.json`,
so the claim, refusal, wait and free are the same ones a Cursor edit gets, and prints what Cursor's agent would
read (the block above). After step 3, run it again: it prints `auth/session.ts is free now; you can retry
ui/LoginForm.tsx.`, then writes the file (one comment line) as `cursor@main`. `npm run demo:cursor -- --end` ends
that scripted session. Say on camera that this is Cursor's hook driven from the terminal.

## Optional: the same task to both

```
Add a 'remember me' option to login: a checkbox on the login form and a longer session when it's ticked.
```

Both need `ui/LoginForm.tsx`, `api/login.ts` and `auth/session.ts`. Who is refused, and on which file, depends on
which agent edits first and in which order: often the second agent's first edit is a file the first already
claimed, so the refusal reads `(same file)` rather than an import path. Use it after the main take, not instead of it.

## Optional: different areas, no interference

Claude Code: `Show the current year in the footer's copyright line.`
Cursor: `Make note search case-insensitive and show the number of results in the search box.`

The footer and search files share no import path within 3 hops (`lib/utils.ts` is a hub and does not count). Both
edit freely; the dashboard shows two sets of claims and no refusal.

## Between takes

1. `/exit` in Claude Code; start a new chat in Cursor.
2. `npm run demo:reset`: `git reset --hard demo-start` and `git clean -fd` in `~/switchboard-demo` only (the
   git-ignored hook settings stay), clears every agent, claim, wait and event from `sb_demo_live`, and parses again.
3. Reload the dashboard (Cmd+R), start `claude` again, new Cursor chat.

`npm run demo:stop` stops the dashboard when you are done.

## 60-second talk track

Lines in [brackets] depend on what the agents do; say them only when you see it.

> "Two coding agents on one repo: Claude Code on the left, Cursor on the right. This is the live graph of the
> app's imports, stored in FalkorDB Cloud.
> I ask Claude to change the session code. (paste) It claims auth/session.ts; there's the claim, live.
> Now I ask Cursor for something else: a field on the login form. (paste) Different file. But the login form
> imports the login API, which imports the session file Claude is changing.
> Switchboard walks that path in the graph and stops Cursor before it writes, and tells it why: this file,
> through these two imports, held by Claude. A file lock would have said yes.
> Cursor is now waiting; you can see it here.
> I give Claude its next step. [It's told Cursor is waiting on its file.] [It releases its claim.] / [I end its
> session, which releases it.]
> The file is free, and Cursor hears it: (try again) [it makes its edit].
> No locks to manage: hooks in both editors and one graph query in FalkorDB Cloud."

If you used the fallback, replace the Cursor lines with: "Here I play Cursor's hook from the terminal, the same
command Cursor runs before every write."

## Cursor desktop dry run (5 minutes, before recording)

1. `npm run demo:reset`, `npm run demo:start -- --no-open`, open the dashboard.
2. `cursor ~/switchboard-demo` from a terminal (so the hooks find `node`), new Agent chat. Accept any prompt to
   trust the folder or enable hooks.
3. Claude Code: step 1 of the take. Wait for the claim on the dashboard.
4. Cursor: step 2 of the take. Look for: the edit blocked in Cursor's chat with the `─imports→` path, and
   `Cursor · main refused` on the dashboard.
5. `npm run demo:log` (the last 15 hook decisions). Expect a line like
   `... cursor pre deny ui/LoginForm.tsx for cursor@main: ✗ Switchboard blocked this edit | ...`.
   - A `cursor pre allow ui/LoginForm.tsx` line instead: Cursor's write reached the hook but nobody held
     session.ts (Claude's claim missing; check its card).
   - No `cursor` line at all: Cursor's hooks did not run. Check `~/switchboard-demo/.cursor/hooks.json` exists,
     reopen the folder from the terminal, look in Cursor's Settings for Hooks. If they still do not run, record
     with the fallback (`npm run demo:cursor -- ui/LoginForm.tsx`).
6. Steps 3 and 4 of the take; `npm run demo:log` should end with `cursor pre allow ui/LoginForm.tsx for cursor@main (claimed)`.
7. `/exit` in Claude Code, `npm run demo:reset`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Header says `local`, not `FalkorDB Cloud`, or no events appear | `npm run demo:stop && npm run demo:start -- --no-open`. Check `<graph-hacks>/.env` has the four `FALKORDB_CLOUD_*` keys. |
| `Port 8790 is taken` | `lsof -nP -iTCP:8790 -sTCP:LISTEN`, stop that program. |
| Claude never claims | `cat ~/switchboard-demo/.claude/settings.local.json` should list the hooks; `/hooks` in Claude Code shows them. |
| Cursor is never refused | The dry run above; then the fallback. |
| Session start says `Switchboard is installed but off` | The hook could not reach the cloud graph (network, or the `.env` keys). Edits are not checked until it can. |
| An edit takes about 2 seconds to start | Each hook starts Node and connects to the cloud graph; the limit is 3 s, then the edit is allowed. Close heavy apps before recording. |
| Both agents show as `claude@main` | Two Claude Code sessions on one branch are one agent. Use Claude Code and Cursor. |
| A claim is left after a crash | Claims expire after 30 minutes, or `npm run demo:reset`. |

## Tested on 2026-10-17

Two real runs against `sb_demo_live` on FalkorDB Cloud, from `npm run demo:reset`, dashboard from
`npm run demo:start -- --no-open`, Claude Code 2.1.302 (`claude -p --model sonnet`, accept-edits, Switchboard MCP
tools allowed) in `~/switchboard-demo`.

- **Cursor's side was the fallback.** `cursor-agent -p` on this Mac answers `Authentication required. Please run
  'agent login' first`, and the Cursor app cannot be driven from a script, so Cursor's side ran through
  `npm run demo:cursor -- ui/LoginForm.tsx` (Cursor's own hook commands). No Cursor model has seen these messages
  yet: do the dry run above before recording.
- **Run 1 (one prompt, `claude -p`).** Claude read and edited `auth/session.ts` (claim #163, edit #164). Cursor's
  write of `ui/LoginForm.tsx` was refused with `ui/LoginForm.tsx ─imports→ api/login.ts ─imports→ auth/session.ts`,
  `held by claude@main` (conflict #165, wait #166). Claude's session ended without another edit, so it never heard;
  its end released the claim (#167) and recorded `free` with waiters `cursor@main` (#168). Cursor's next run read
  `auth/session.ts is free now; you can retry ui/LoginForm.tsx.` and its write went through (#169, #170).
- **Run 2 (the take as written: one open Claude session, prompts 1 and 3).** Same claim, edit, refusal and wait
  (#173 to #176). On prompt 3 Claude edited `auth/session.ts` again, was told Cursor was waiting, called the
  `release` MCP tool on its own (`{"paths":["auth/session.ts"]}` → `released 1`, #179) and ended with
  "I also released the Switchboard claim on auth/session.ts, since cursor@main was waiting on it to edit
  ui/LoginForm.tsx." `free` #180; Cursor's retry read the free notice and was allowed (#181, #182).
- Every edit was re-parsed into the cloud graph by the dashboard's server (`graph updated auth/session.ts (95.8 ms)`
  and the like in its log). The dashboard showed the refusal path, `Collisions prevented 1`, Cursor `waiting`,
  then `can go`, then `active` holding `ui/LoginForm.tsx` (a freed waiter that claims or ends does not go back
  to `blocked`).
