---
name: switchboard
description: How to work when Switchboard coordinates the agents on this repo. Use when an edit is refused with "Switchboard blocked this edit", when the session brief mentions Switchboard, or before starting work another agent may be doing.
---

# Switchboard

Switchboard keeps several AI coding agents (Claude Code, Cursor, others) from breaking each other's work.
It keeps the repo's import graph in FalkorDB. Each agent's edits become claims on files in that graph.

You do not have to call anything for this to work. The plugin's hooks run on their own:

- **Session start**: you get a brief: the graph, your agent id (`claude-code@<branch>`), who holds what, recent decisions and lessons. The repo is re-parsed in the background.
- **Before every Edit, MultiEdit, Write or NotebookEdit**: the file is claimed for you. If another agent holds that file, or a file within 3 import hops of it, the edit is refused.
- **After every edit**: the edit is recorded in the graph and the import graph is refreshed in the background.
- **Session end**: your claims are released.

## Reading a refusal

```
✗ Switchboard blocked this edit
src/login.ts ─imports→ src/session.ts ─imports→ src/db.ts
held by cursor@main "rename db url" · free in 28 min
Safe now: src/util.ts
Don't work around this with Bash. Pick another file or call brief_me.
```

- Line 2 is the import path from the file you wanted to the file someone holds. `(same file)` means they hold that exact file.
- Line 3 is the holder, their task and intent if they gave one, and when the claim expires.
- `Safe now` lists files you can edit without a collision, when Switchboard found some.

## What to do when refused

1. Do not edit the file another way (Bash, sed, a script, a new file that replaces it). That defeats the check.
2. Tell the user in one line: which file, who holds it, the import path.
3. Pick a safe file, or a part of the task that does not touch that path, and carry on.
4. If you need the blocked file, wait for the claim to free up, or ask the user to coordinate. The `handoff` tool passes a task to the other agent with a note.

## Leave memory for the next agent

The MCP server `switchboard` has 13 tools. The ones worth calling yourself:

- `brief_me`: who is working near a file or task, decisions and lessons about it. Call it before a big change.
- `record_decision`: when you choose an approach others must respect (text, why, affected files).
- `record_lesson`: a gotcha about a file that the next agent needs.
- `handoff`: pass a task to another agent with a note.
- `blast_radius`: the files that import a file, hop by hop, before you change its exports.
- `status`, `why`, `parallel_batches`, `plan_task`, `release`.

Paths are repo-relative, such as `src/db.ts`.

## When Switchboard is off

The brief says so when FalkorDB cannot be reached. Edits are then allowed and nothing is checked.
Start FalkorDB with `docker run -d -p 6379:6379 falkordb/falkordb`, then start a new session.
A file the parser has not seen yet (a new file) is allowed with a note that no dependency check ran.

Settings, as environment variables: `FALKORDB_URL` (default `redis://localhost:6379`), `SB_GRAPH`
(default `sb_<repo name>`, shared by every worktree of the repo), `SB_AGENT` (default `claude-code@<branch>`),
`SB_URL` (a Switchboard dashboard to link in the brief), `SWITCHBOARD_OFF=1` to turn the hooks off.
