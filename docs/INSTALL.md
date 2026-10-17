# Installing Switchboard

Switchboard runs in the background. Once it is installed, an agent never has to be told to use it: hooks
claim each file before the agent edits it (or writes it from the shell), refuse an edit that collides with
another agent's work, tell both agents when one waits on the other, record the edit, and release the claims
when the session ends. [How it works](HOW-IT-WORKS.md) shows what each agent sees. The MCP server and the skill are there for when the
agent wants more (a brief, a decision, a handoff).

There are four ways in. All of them talk to the same FalkorDB graph, so a Claude Code session and a Cursor
session on one repo see each other.

| Way | For | What you run |
| --- | --- | --- |
| Claude Code plugin | Claude Code | `/plugin marketplace add bhargava-gumpula/graph-hacks` then `/plugin install switchboard@switchboard` |
| Cursor | Cursor | the Add to Cursor button, then `npm i -g switchboard-agents && switchboard init --cursor` in the repo |
| npm package | any MCP client | `npm i -g switchboard-agents`, then `switchboard init` or `switchboard-mcp` |
| From source | the demo, the dashboard, hacking on Switchboard | `npm run quickstart` (see the README) |

## What every way needs

- **Node 22 or newer** on `PATH`. The hooks and the MCP server are single-file Node scripts.
- **FalkorDB.** `docker run -d -p 6379:6379 falkordb/falkordb`, or point `FALKORDB_URL` at one you have.
- Nothing else. No `jq`, no clone of this repo, no `npm install` for the plugin.

## Claude Code plugin

```
/plugin marketplace add bhargava-gumpula/graph-hacks
/plugin install switchboard@switchboard
```

On Claude Code 2.1.275 or later, one line does both: `/plugin install switchboard --marketplace bhargava-gumpula/graph-hacks`.
From a shell: `claude plugin marketplace add bhargava-gumpula/graph-hacks && claude plugin install switchboard@switchboard`.

The plugin lives in [`plugins/switchboard`](../plugins/switchboard) and the marketplace in
[`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json). It carries:

| Part | File | What it does |
| --- | --- | --- |
| Hooks | `hooks/hooks.json` | `SessionStart`: register the agent, re-parse the repo in the background, add a brief to the context. `PreToolUse` on `Edit\|MultiEdit\|Write\|NotebookEdit\|Bash`: claim the file (or a shell command's obvious write targets), or deny with the import path and wait. `PostToolUse`: record the edit (for `Bash`, the files `git status` shows it changed) and refresh the import graph in the background. Both tell the agent who waits on its files and which files it waited on are free. `SessionEnd`: release this agent's claims. |
| MCP server | `.mcp.json` | `switchboard`, 13 tools (`claim`, `brief_me`, `record_decision`, `handoff`, ...). |
| Skill | `skills/switchboard/SKILL.md` | What Switchboard is, how to read a refusal, what to do next. |
| Runtime | `dist/*.mjs` | The hook, the MCP server and the CLI, bundled with esbuild by `npm run build:plugin`. |

Try it from a checkout without installing: `claude --plugin-dir ./plugins/switchboard`.

## Cursor

1. **MCP server.** Click the button, or open the link:

   [![Add switchboard MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=switchboard&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInN3aXRjaGJvYXJkLWFnZW50cyIsIm1jcCJdLCJlbnYiOnsiU0JfRURJVE9SIjoiY3Vyc29yIiwiU0JfUFJPSkVDVF9ESVIiOiIke3dvcmtzcGFjZUZvbGRlcn0ifX0=)

   The app link is `cursor://anysphere.cursor-deeplink/mcp/install?name=switchboard&config=<same base64>`.
   The config it installs, decoded:

   ```json
   {"command":"npx","args":["-y","switchboard-agents","mcp"],"env":{"SB_EDITOR":"cursor","SB_PROJECT_DIR":"${workspaceFolder}"}}
   ```

2. **Hooks.** In the repo:

   ```bash
   npm i -g switchboard-agents
   switchboard init --cursor
   ```

   This writes `.cursor/hooks.json` (sessionStart, preToolUse on `Write` and `Delete`, beforeShellExecution,
   afterFileEdit, afterShellExecution, postToolUse on `Write` and `Shell`, sessionEnd) and a project
   `.cursor/mcp.json`, then parses the repo into its graph. It merges: your other hooks and servers stay.
   Restart Cursor in the repo.

What Cursor's hooks can and cannot do (from Cursor's hooks docs, checked 2026-10-17):

- `preToolUse` with `permission: "deny"` stops the edit and shows the reason to you (`user_message`) and to the
  agent (`agent_message`). This is the check that matters, and it works like Claude Code's.
  `beforeShellExecution` does the same for a shell command's obvious write targets.
- `agent_message` is documented for denials only, so "someone waits on your file" and "the file is free now"
  arrive on the next `postToolUse`, as `additional_context`.
- `afterFileEdit` and `afterShellExecution` run afterwards and cannot block. Switchboard only records edits there.
- `sessionStart` and `sessionEnd` are fire-and-forget. In our earlier tests Cursor did not show the
  session-start brief to the agent, so ask it to call `brief_me` first if you want the brief.
- Hooks do not run in Cursor's cloud agents, and they skip read-only exploratory turns.
- Cursor does not document the working directory of a stdio MCP server, so the config passes
  `SB_PROJECT_DIR=${workspaceFolder}`. If a global install starts the server outside your repo, use the project
  `.cursor/mcp.json` that `init` writes, or set `SB_GRAPH`.
- Cursor also runs Claude Code hooks from `.claude/settings.json`. The Claude hook skips events that carry
  `cursor_version`, so an edit is never checked twice.

## npm package `switchboard-agents`

```bash
npm i -g switchboard-agents
switchboard --help
```

| Bin | What it is |
| --- | --- |
| `switchboard` (also `switchboard-agents`) | The CLI: `init`, `status`, `claim`, `check`, `brief`, `why`, `blast`, `parse`, `decide`, `lesson`, `handoff`, `plan`, `batches`, plus `mcp` and `hook`. |
| `switchboard-mcp` | The stdio MCP server. |

`switchboard init [dir] [--cursor] [--claude] [--dry-run]` writes `.cursor/hooks.json` and `.cursor/mcp.json`
(Cursor), and `.claude/settings.local.json` hooks and `.mcp.json` (Claude Code); both by default. Each MCP config
passes `SB_EDITOR`, so the MCP server and the hooks use the same agent id. The configs point at
this install's absolute paths, so run `init` again after moving Node or reinstalling. Run through `npx`, the
paths land in the npx cache, which npm may clean; `init` warns about that.

- Claude Code reads `.claude/settings.local.json` like `settings.json`, and `init` adds it to the repo's
  `.gitignore`, so the hook paths are never committed. Hooks an older `init` left in `.claude/settings.json`
  move there.
- `.mcp.json`, `.cursor/hooks.json` and `.cursor/mcp.json` still hold this install's paths: Claude Code has no
  per-machine `.mcp.json` and Cursor has no per-machine hooks file. Keep them out of commits, or write portable
  configs with `npm run switchboard -- init <repo> --npx` from a clone.
- A file that already holds what `init` wants is left as it is, so a second run writes nothing.

Any other MCP client: run `switchboard-mcp` from the repo, or `npx -y switchboard-agents mcp`.

## Settings

All optional, as environment variables.

| Variable | Default | Notes |
| --- | --- | --- |
| `FALKORDB_URL` | `redis://localhost:6379` | |
| `SB_GRAPH` | `sb_<repo name>` | The name of the main checkout, so every worktree of a repo shares one graph. |
| `SB_AGENT` | `<editor>@<branch>` | `claude@main`, `cursor@feature-x`. The MCP server, the CLI and the hooks use the same id. |
| `SB_EDITOR` | set by the configs | `claude` or `cursor`: the editor half of the id for the MCP server and the CLI. The hooks get it from their arguments. |
| `SB_MODE` | `enforce` | `warn` allows every edit and gives the agent the refusal text as context instead. |
| `SB_URL` | none | A running Switchboard dashboard (from source: `npm run server`), linked in the session brief. |
| `SWITCHBOARD_OFF` | unset | `1` lets every edit through. |
| `SB_HOOK_LOG` | `$TMPDIR/switchboard-hook.log` | One line per hook decision. |

For the Claude Code plugin, put them in your shell environment or in the `env` block of `~/.claude/settings.json`.

## What happens when two agents want the same code

Say Claude Code and Cursor both work on one repo, and Claude Code edits `auth/session.ts` first.

1. Claude Code's `PreToolUse` hook claims `auth/session.ts` in the graph. The claim lasts 30 minutes and every
   further edit renews it.
2. Cursor's agent tries to edit `ui/LoginForm.tsx`, which imports `api/login.ts`, which imports
   `auth/session.ts`. Its `preToolUse` hook finds Claude Code's claim within 3 import hops and denies the edit:

   ```
   ✗ Switchboard blocked this edit
   ui/LoginForm.tsx ─imports→ api/login.ts ─imports→ auth/session.ts
   held by claude@main · free in 30 min
   Don't work around this with Bash. Pick another file or call brief_me.
   You are now waiting on auth/session.ts; Switchboard tells you here when it is free.
   ```

3. Claude Code is not blocked: the first claim wins. On its next hook call it reads
   `cursor@main is waiting on auth/session.ts: it wants ui/LoginForm.tsx, 2 imports from your claim. Release it when you're done: switchboard release auth/session.ts --agent claude@main`.
4. When Claude Code's session ends (or it releases the file, or the claim expires), Cursor's next hook call reads
   `auth/session.ts is free now; you can retry ui/LoginForm.tsx.` and the retry goes through.

[How it works](HOW-IT-WORKS.md) has the whole story, shell commands, `SB_MODE=warn` and the graph model.

Two sessions with the same agent id never block each other: that is one agent. Two Claude Code sessions on the
same branch share `claude@<branch>`, so give one its own worktree or set `SB_AGENT`.

## From source: `npm run switchboard -- init <repo>`

From a clone of this repo, `init` wires another repo to this checkout and parses it into `sb_<repo name>`:

- Claude Code's hooks go in `.claude/settings.local.json`, which holds this machine's path to
  `packages/hooks/hook.sh`. Claude Code reads it like `settings.json`, and `init` adds it to the repo's
  `.gitignore`, so no machine path is committed. Hooks an older `init` left in `.claude/settings.json` move there.
- Cursor has no per-machine hooks file, so `.cursor/hooks.json` carries the path. Keep it out of commits, or use
  `--npx`.
- `.mcp.json` and `.cursor/mcp.json` start the MCP server from this checkout, with `SB_EDITOR` set.
- `--npx` writes `npx -y switchboard-agents hook <editor> <phase>` and `npx -y switchboard-agents mcp` everywhere
  instead: no machine paths, safe to commit. Use it once `switchboard-agents` is published to npm; until then,
  `npx` would fetch whatever package holds that name.

`init` merges and is idempotent: a second run changes nothing. `--dry-run` prints the diff.
`packages/hooks/hook.sh` needs no `jq`: it runs the Node hook (`switchboard hook <editor> <phase>`) through `tsx`.

## Demo: Claude Code and Cursor on one repo, with the live graph

Before the npm package is published, install it from this checkout. Run these from the graph-hacks root.

```bash
npm run build:plugin
(cd packages/npm && npm pack && npm i -g ./switchboard-agents-0.1.0.tgz)

# A small repo to fight over: a copy of demo-repo with its own git history.
cp -R demo-repo ~/sb-demo && cd ~/sb-demo && git init -q && git add -A && git commit -qm init
switchboard init --cursor      # Cursor hooks + MCP, parses ~/sb-demo into graph sb_sb_demo
cd -

# The dashboard on that graph (any free port; 8787 and 8788 are taken here).
npm run build -w @switchboard/web
SERVER_PORT=8795 SB_GRAPH=sb_sb_demo npm run server     # open http://localhost:8795/app
```

Then, in two windows:

- **Claude Code** with the plugin: `cd ~/sb-demo && SB_URL=http://localhost:8795 claude --plugin-dir ~/path/to/graph-hacks/plugins/switchboard`
  (or install it once with `claude plugin marketplace add ~/path/to/graph-hacks` and `claude plugin install switchboard@switchboard`).
- **Cursor**: `cursor ~/sb-demo`.

Give both the same kind of job, for example "change how sessions expire". Whoever edits first holds the file;
the other is refused with the import path and the dashboard shows the claim and the refusal as they happen.
Do not also run `switchboard init --claude` in a repo where the plugin is on: Claude Code would run both hook sets.

## MCP registry

[`packages/npm/server.json`](../packages/npm/server.json) describes the npm package for the official MCP registry as
`io.github.bhargava-gumpula/switchboard`, and `packages/npm/package.json` carries the matching `mcpName`. It validates
against the 2025-12-11 server schema.

## Owner commands

Nothing here has been published. Each step is yours to run, in this order.

```bash
# 0. Merge this branch to main and push, so `/plugin marketplace add bhargava-gumpula/graph-hacks` finds the plugin.

# 1. Rebuild the bundles after any change to packages/* (plugins/switchboard/dist is committed).
#    npm run check:plugin exits 1 when the committed bundles are stale, e.g. after merging a core change.
npm run build:plugin
claude plugin validate ./plugins/switchboard && claude plugin validate .

# 2. Publish the npm package (the name switchboard-agents was free on 2026-10-17).
cd packages/npm
npm login
npm publish --access public      # prepack rebuilds dist first

# 3. Publish to the MCP registry, from packages/npm.
brew install mcp-publisher
mcp-publisher login github       # as bhargava-gumpula
mcp-publisher publish
```

For a new version, bump `version` in `packages/npm/package.json`, `packages/npm/server.json` (twice) and
`plugins/switchboard/.claude-plugin/plugin.json`, then repeat 1 to 3.

## Limits

- The CLI bundle is about 8 MB because the parser carries the TypeScript compiler (ts-morph). The hook bundle,
  which runs on every edit, is about 0.7 MB and answers in about 0.1 s. From source, `hook.sh` runs the hook
  through `tsx`, about 0.8 s.
- Shell commands: only obvious write targets are claimed before a command runs (redirections, `tee`, `sed -i`,
  `mv`, `cp`, `rm`, `touch`, `git checkout --`). The files it changed are recorded after it, from `git status`,
  except files another agent claims or edited while it ran (the checkout is shared; those edits are theirs).
- Only TypeScript and JavaScript imports are parsed. The parser skips `node_modules`, `dist`, `out`, `build`,
  `coverage`, dot directories (`.next`, `.turbo`, `.vercel`) and what the repo's root `.gitignore` lists (simple
  patterns; nested `.gitignore` files are not read). A file the parser has not seen (a new file) is allowed,
  with a note that no dependency check ran.
- The background re-parse runs at most every 20 seconds per graph, so an import added inside that window
  shows up on the next edit.
- The live dashboard is not in the npm package; run it from source and set `SB_URL`.
- Tested on macOS with Claude Code 2.1.302. Windows is untested.

## Sources

- Claude Code plugins reference: https://code.claude.com/docs/en/plugins-reference
- Claude Code plugin marketplaces: https://code.claude.com/docs/en/plugin-marketplaces
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Claude Code MCP: https://code.claude.com/docs/en/mcp
- Cursor MCP install links: https://cursor.com/docs/context/mcp/install-links
- Cursor MCP config and variables: https://cursor.com/docs/context/mcp
- Cursor hooks: https://cursor.com/docs/agent/hooks
- MCP registry quickstart: https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx
- MCP server.json schema: https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json
