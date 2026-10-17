# Live demo: Claude Code and Cursor on one repo, graph in FalkorDB Cloud

Claude Code (terminal) and Cursor (desktop app) open the same small TypeScript app. You give both the same task.
The first one to edit a login file holds it. When the second reaches for a related file, Switchboard refuses
the edit with the import path, tells the holder that someone is waiting, and tells the waiter when the file is
free. The dashboard shows each claim, refusal, wait and import change as it happens, read from FalkorDB Cloud.

## Once: set up

From the Switchboard checkout (this branch, `demo/kit`):

```bash
npm run demo:setup
```

It makes `~/switchboard-demo`, a git copy of `demo-repo` (35 files, a notes app with login, sessions and
settings). It wires both editors (Claude Code hooks in the git-ignored `.claude/settings.local.json`, Cursor hooks in
`.cursor/hooks.json`, the MCP server in `.mcp.json` and `.cursor/mcp.json`), commits that as `demo-start`, and
parses the repo into graph `sb_demo_live` on FalkorDB Cloud. Run it again to start over from scratch (it replaces only
a folder it made). Stop the dashboard first (`npm run demo:stop`).

**One folder for both editors, not two worktrees.** Both editors open `~/switchboard-demo`, which is what the audience
expects ("the same project") and is exactly the case Switchboard is for: two agents writing files on one disk.
The ids still differ (`claude@main`, `cursor@main`), so they collide like two people would. The dashboard's server
re-parses each edited file from this one folder, so every edit from either editor updates the graph's imports live.
With a second worktree, that editor's edits would be recorded but re-parsed from the wrong folder.

**No password in the demo repo.** Every hook command and MCP config carries `SB_ENV_FILE=<graph-hacks>/.env` and
`SB_CLOUD=1`. At run time core reads only `FALKORDB_CLOUD_HOST/PORT/USERNAME/PASSWORD` from that git-ignored file and
builds the URL in memory. `SB_CLOUD=1` wins over a `FALKORDB_URL` left in your shell, so no editor can drift to the
local graph. Errors print the URL as `redis://falkordb:***@host:port`.

## Before each take

1. **Dashboard.** `npm run demo:start` starts it on port 8790 against the cloud graph (`SB_WATCH=1`, so your own
   saves show too) and opens http://localhost:8790/app. `--no-open` skips the browser.
   Check the header: it reads `switchboard-demo: live agents on a 35-file repo, graph in FalkorDB Cloud`
   (wide window), and `curl -s localhost:8790/api/health` says `"where":"cloud"`.
2. **Install it as an app (once).** In Chrome or Edge on http://localhost:8790/app: the install icon at the right of
   the address bar, or the menu, Cast, save and share, Install page as app. Safari: File, Add to Dock. Port 8790 is
   its own app, separate from one you installed on 8787. Skip the guided tour once; it stays skipped.
3. **Claude Code.** In a terminal: `cd ~/switchboard-demo && claude`. Trust the folder if asked. Press Shift+Tab once
   for "accept edits on", so it does not stop for approval on camera. The switchboard MCP server is pre-approved.
4. **Cursor.** `cursor ~/switchboard-demo` (or File, Open Folder). The hooks in `.cursor/hooks.json` load with the
   folder; if Cursor asks to trust or enable them, say yes. Optional: Cursor Settings, MCP, turn on `switchboard`
   (for `brief_me`, `claim`, `release`). Open a new Agent chat.
5. Arrange: terminal left, Cursor right, the dashboard app on top or on a second screen.

## Scenario 1: same task, collides on login (the main take)

Paste into **Claude Code** first, then into **Cursor** about five seconds later:

```
Add a 'remember me' option to login: a checkbox on the login form and a longer session when it's ticked.
```

Both need `ui/LoginForm.tsx`, `api/login.ts` and `auth/session.ts` (`LoginForm` imports `login`, which imports
`session`), and often `lib/time.ts` for the longer TTL.

What happens (seen in the real run below; whoever edits first plays Claude's part):

- **Claude Code edits first.** Its hook claims each file before the edit. Nothing visible in the terminal.
  Dashboard: `Claude Code · main claimed auth/session.ts`, `... edited auth/session.ts`, and when it adds an import,
  `auth/session.ts now imports lib/time.ts`. The Agents panel lists its claims with a 30-minute countdown.
- **Cursor is refused.** Its edit of a login file is blocked. Cursor shows, and its agent reads:

  ```
  ✗ Switchboard blocked this edit
  ui/LoginForm.tsx ─imports→ api/login.ts ─imports→ auth/session.ts
  held by claude@main · free in 30 min
  Don't work around this with Bash. Pick another file or call brief_me.
  You are now waiting on auth/session.ts; Switchboard tells you here when it is free.
  ```

  (If it reaches for a file Claude already edited, the second line is `api/login.ts (same file)`.)
  Dashboard: the counter `Collisions prevented` goes up, the feed shows `Cursor · main refused: ... reaches
  auth/session.ts (Claude Code · main) in 2 hops` and `Cursor · main is waiting for auth/session.ts, held by Claude Code
  · main`, the Agents panel shows Cursor as `waiting`, and the graph lights the refused path.
- **Claude Code hears it.** On its next edit or command it gets
  `cursor@main is waiting on auth/session.ts: it wants ui/LoginForm.tsx, 2 imports from your claim. Release it when you're done: switchboard release auth/session.ts --agent claude@main`.
  In the real run Claude finished its change and then tried to run that release command itself.
- **Free.** When Claude is done, either let it run the release (approve it), or type `/exit` (ending the session
  releases every claim). Dashboard: a `free` row. Then tell Cursor `try again`: its next tool use reads
  `auth/session.ts is free now; you can retry ui/LoginForm.tsx.` and the edit goes through.

A Claude agent that has the MCP server often checks first (`brief_me`, `status`, `claim`) instead of editing
straight away. Then the refusal comes back from the `claim` tool (`CONFLICT ... You are now waiting on
auth/session.ts ...`), the wait is recorded the same way, and Claude stops and says who holds what. That happened
in the real run where Cursor edited first.

## Scenario 2: same task, collides on settings

```
Add a 'compact mode' setting: store it in the user's preferences, expose it in the settings API, and add a toggle for it in the settings panel.
```

`ui/SettingsPanel.tsx` imports `api/settings.ts`, which imports `lib/prefs.ts`. The second editor gets
`ui/SettingsPanel.tsx ─imports→ api/settings.ts ─imports→ lib/prefs.ts` (or the reverse direction), and the same
wait and free notices.

## Scenario 3: different areas, no interference

To show it stays out of the way, give each editor its own task at the same time.

Claude Code:
```
Show the current year in the footer's copyright line.
```

Cursor:
```
Make note search case-insensitive and show the number of results in the search box.
```

The footer (`ui/Footer.tsx`, maybe `lib/time.ts`) and search (`ui/SearchBox.tsx`, `api/search.ts`, `api/notes.ts`)
share no import path within 3 hops (`lib/utils.ts` is a hub and does not count). Both edit freely; the dashboard
shows two sets of claims and edits and no refusal.

## Between takes

1. End both agents: `/exit` in Claude Code, close the chat in Cursor (or start a new one).
2. `npm run demo:reset`: the repo goes back to `demo-start` (`git reset --hard` and `git clean -fd` in
   `~/switchboard-demo` only; the git-ignored hook settings stay), every agent, claim, wait, event, decision and
   task is cleared from `sb_demo_live`, and the repo is parsed again. The code graph and the event counter stay.
3. Reload the dashboard (Cmd+R). Start new agent sessions.

`npm run demo:stop` stops the dashboard when you are done.

## 60-second talk track

> "Two coding agents, one repo. Claude Code on the left, Cursor on the right, same project folder. I'll give them
> the same job: remember-me on login. (paste, paste)
> Claude gets there first: it's editing the session code. You can see its claims here, live, and this is the
> import graph of the app, stored in FalkorDB.
> Now Cursor wants the login form. The login form imports the login API, which imports the session file Claude
> is changing. Switchboard walks that path in the graph and stops Cursor before it writes, and tells it exactly
> why: this file, through these two imports, held by Claude.
> Cursor is now waiting, and Claude was just told someone's waiting on it. Nobody overwrote anybody.
> Every edit updates the graph: when Claude added an import, the edge appeared here.
> Claude's done, it releases, Cursor is told the file is free and picks the work up.
> No locks to manage, no prompts to remember. It's hooks in both editors and one graph query in FalkorDB Cloud,
> about a hundred milliseconds."

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Header or health says `local`, or no events appear | `npm run demo:stop && npm run demo:start`. Check `<graph-hacks>/.env` has the four `FALKORDB_CLOUD_*` keys. |
| `Port 8790 is taken` | Something else uses it. `lsof -nP -iTCP:8790 -sTCP:LISTEN`, stop that program. |
| Cursor is never refused | Open the folder from the terminal (`cursor ~/switchboard-demo`) so the hooks find `node`. Check `.cursor/hooks.json` exists. Each hook decision is one line in `$TMPDIR/switchboard-hook.log` (`grep cursor`). |
| Claude never refused / never claims | `cat ~/switchboard-demo/.claude/settings.local.json` should list the hooks. `/hooks` in Claude Code shows them. |
| Session start says `Switchboard's session brief failed` | The brief query failed; edits are still checked. Note the message and carry on. |
| Session start says `Switchboard is installed but off` | The hook could not connect: network, or the `.env` keys. Edits are not checked until it can. |
| An edit takes about 2 seconds to start | Each hook connects to the cloud graph (about 1.8 s with process start; the limit is 3 s, and a timeout allows the edit). |
| Both agents run as `claude@main` | Two Claude Code sessions on one branch are one agent. Use Claude Code and Cursor, or set `SB_AGENT`. |
| Dashboard buttons Play the demo / Reset demo | They answer 409 on this graph (it is a real repo, not demo-repo). Use `npm run demo:reset`. |
| Hooks or agents are slow | A busy laptop slows every hook (each starts Node). Close other heavy work before recording. |
| Stale claim after a crash | Claims expire after 30 minutes, or run `npm run demo:reset`. |

## Tested on 2026-10-17

Real Claude Code agents (`claude -p --model haiku`, Claude Code 2.1.302, haiku 5.5) ran the scenario 1 prompt in
`~/switchboard-demo` against `sb_demo_live` on FalkorDB Cloud, with Cursor's side driven through the exact commands
in `.cursor/hooks.json` with Cursor-shaped events (`preToolUse`, `afterFileEdit`, `postToolUse`, `sessionEnd`).

- Claude first: Claude claimed and edited `lib/time.ts`, `auth/session.ts`, `api/login.ts`, `ui/LoginForm.tsx`;
  the graph gained `auth/session.ts → lib/time.ts` live; Cursor's write was denied (`held by claude@main`); Claude
  was told someone waited and tried to run the release command; its session end released 4 claims; Cursor's next
  tool use read `api/login.ts is free now; you can retry.` and its retry was allowed.
- Cursor first: Claude called `brief_me`, `status` and `claim`, was refused on `api/login.ts`, `ui/LoginForm.tsx` and
  `lib/time.ts` because of Cursor's claim on `auth/session.ts` (the `lib/time.ts` link was the import Cursor's edit
  had just added), and stopped without editing.
- Cursor first, Claude in one open session (as in a terminal): Claude was refused through `claim` and stopped; the
  graph recorded `wait` (claude@main on auth/session.ts, held by cursor@main); Cursor's next tool use read
  `claude@main is waiting on auth/session.ts, which you hold. Release it when you're done: ...`; Cursor's session
  end released it and the graph recorded `free` (waiters: claude@main); told `Try again.`, Claude claimed the four
  files, edited them (each edit re-parsed in the cloud graph) and released them.

Not tested: the Cursor agent itself. `cursor-agent` on this Mac reports "Not logged in" and the Cursor desktop
app cannot be driven from a script, so no real Cursor model received these messages. Cursor's hooks docs say a
`preToolUse` deny reaches the agent as `agent_message` and the user as `user_message`; the installed
`cursor-agent` 2026.10.01 bundle also contains the hook executor (`preToolUse`, `postToolUse`, with `cwd` in the
payload). Do one dry take in Cursor before recording. If Cursor's hooks do not fire, the demo still works
through MCP: turn on the `switchboard` MCP server in Cursor and start the chat with
`Before you edit any file, call the switchboard claim tool with the files; if it reports a conflict, do not edit them.`
