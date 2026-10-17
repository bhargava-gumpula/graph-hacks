# Installing Switchboard

Switchboard runs in the background. Once it is installed, an agent never has to be told to use it: hooks
claim each file before the agent edits it, refuse an edit that collides with another agent's work, record
the edit, and release the claims when the session ends. The MCP server and the skill are there for when the
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
- Nothing else. No `jq`, no clone of this repo, no `npm install` for the plugin. (The from-source hooks in
  `packages/hooks/hook.sh` still use `jq`.)

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
| Hooks | `hooks/hooks.json` | `SessionStart`: register the agent, re-parse the repo in the background, add a brief to the context. `PreToolUse` on `Edit\|MultiEdit\|Write\|NotebookEdit`: claim the file, or deny with the import path. `PostToolUse`: record the edit and refresh the import graph in the background. `SessionEnd`: release this agent's claims. |
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

   This writes `.cursor/hooks.json` (sessionStart, preToolUse on `Write`, afterFileEdit, sessionEnd) and a
   project `.cursor/mcp.json`, then parses the repo into its graph. It merges: your other hooks and servers stay.
   Restart Cursor in the repo.

What Cursor's hooks can and cannot do (from Cursor's hooks docs, checked 2026-10-17):

- `preToolUse` with `permission: "deny"` stops the edit and shows the reason to you (`user_message`) and to the
  agent (`agent_message`). This is the check that matters, and it works like Claude Code's.
- `afterFileEdit` runs after the edit and cannot block it. Switchboard only records the edit there.
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
(Cursor), and `.claude/settings.json` hooks and `.mcp.json` (Claude Code); both by default. The configs point at
this install's absolute paths, so run `init` again after moving Node or reinstalling. Run through `npx`, the
paths land in the npx cache, which npm may clean; `init` warns about that.

Any other MCP client: run `switchboard-mcp` from the repo, or `npx -y switchboard-agents mcp`.

## Settings

All optional, as environment variables.

| Variable | Default | Notes |
| --- | --- | --- |
| `FALKORDB_URL` | `redis://localhost:6379` | |
| `SB_GRAPH` | `sb_<repo name>` | The name of the main checkout, so every worktree of a repo shares one graph. |
| `SB_AGENT` | `<editor>@<branch>` | `claude-code@main`, `cursor@feature-x`. The MCP server and the hooks use the same id. |
| `SB_URL` | none | A running Switchboard dashboard (from source: `npm run server`), linked in the session brief. |
| `SWITCHBOARD_OFF` | unset | `1` lets every edit through. |
| `SB_HOOK_LOG` | `$TMPDIR/switchboard-hook.log` | One line per hook decision. |

For the Claude Code plugin, put them in your shell environment or in the `env` block of `~/.claude/settings.json`.

## What happens when two agents want the same code

Say Claude Code and Cursor both work on one repo, and Cursor edits `src/db.ts` first.

1. Cursor's `preToolUse` hook claims `src/db.ts` in the graph. The claim lasts 30 minutes and every further
   edit renews it.
2. Claude Code's agent tries to edit `src/login.ts`, which imports `src/session.ts`, which imports `src/db.ts`.
   Its `PreToolUse` hook asks the graph for a claim within 3 import hops, finds Cursor's, and denies the edit:

   ```
   ✗ Switchboard blocked this edit
   src/login.ts ─imports→ src/session.ts ─imports→ src/db.ts
   held by cursor@main · free in 30 min
   Don't work around this with Bash. Pick another file or call brief_me.
   ```

3. Cursor is not interrupted: the first claim wins, and nothing is sent to the agent that holds it.
   Claude Code reads the refusal (the skill tells it how), says which file and who holds it, and moves to a
   file that does not touch that path.
4. When Cursor's session ends, its claims are released. Claude Code's next try on `src/login.ts` goes through.

Two sessions with the same agent id never block each other: that is one agent. Two Claude Code sessions on the
same branch share `claude-code@<branch>`, so give one its own worktree or set `SB_AGENT`.

## MCP registry

[`packages/npm/server.json`](../packages/npm/server.json) describes the npm package for the official MCP registry as
`io.github.bhargava-gumpula/switchboard`, and `packages/npm/package.json` carries the matching `mcpName`. It validates
against the 2025-12-11 server schema.

## Owner commands

Nothing here has been published. Each step is yours to run, in this order.

```bash
# 0. Merge this branch to main and push, so `/plugin marketplace add bhargava-gumpula/graph-hacks` finds the plugin.

# 1. Rebuild the bundles after any change to packages/* (plugins/switchboard/dist is committed).
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
  which runs on every edit, is about 0.7 MB and answers in about 0.1 s.
- Only TypeScript and JavaScript imports are parsed. A file the parser has not seen (a new file) is allowed,
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
