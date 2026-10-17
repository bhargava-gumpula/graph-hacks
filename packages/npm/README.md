# switchboard-agents

Switchboard stops AI coding agents from breaking each other's work. It keeps your repo's import graph in
[FalkorDB](https://falkordb.com). Every edit an agent makes is claimed in that graph. An edit within 3 import
hops of a file another agent holds is refused, with the import path, the holder and the files that are safe now.

Site and live demo: https://switchboard-agents.xyz · Source: https://github.com/bhargava-gumpula/graph-hacks

## Needs

- Node 22 or later
- FalkorDB: `docker run -d -p 6379:6379 falkordb/falkordb` (or set `FALKORDB_URL`)

## Use it

```bash
npm i -g switchboard-agents
cd your-repo
switchboard init            # Cursor and Claude Code hooks + MCP config, then parses the repo
switchboard init --cursor   # Cursor only
```

Restart the editor in that repo. Every edit is now claimed for you. Nothing to call.

- `switchboard mcp` (or the `switchboard-mcp` bin) is the stdio MCP server, 13 tools.
- `switchboard status`, `check <file>`, `brief --prefix ""`, `why <file>`, `blast <file>` and more: `switchboard --help`.

Claude Code users can install the plugin instead, which bundles the same hooks, the MCP server and a skill:

```
/plugin marketplace add bhargava-gumpula/graph-hacks
/plugin install switchboard@switchboard
```

## Settings

| Variable | Default |
| --- | --- |
| `FALKORDB_URL` | `redis://localhost:6379` |
| `SB_GRAPH` | `sb_<repo name>`, shared by every worktree of the repo |
| `SB_AGENT` | `<editor>@<branch>`, such as `cursor@main` |
| `SB_URL` | none. A Switchboard dashboard to link in the session brief |
| `SWITCHBOARD_OFF` | set to `1` to let every edit through |

MIT License.
