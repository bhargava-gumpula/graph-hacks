# Switchboard: agent instructions for Claude Code

The rules are the same for every agent. They live in `AGENTS.md`:

@AGENTS.md

Claude Code specifics:
- Read `docs/PLAN.md` §17 and `docs/DESIGN.md` before you start.
- Once Switchboard's MCP server is running (B6+), call `claim` before editing a file. If it returns CONFLICT, stop and pick another task or coordinate. Don't work around it.
