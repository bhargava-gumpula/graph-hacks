# Paseo setup for the hackathon (researched 2026-10-13)

**Installed and verified:** Paseo 0.11.2 (desktop app plus `paseo` CLI). Its daemon runs at 127.0.0.1:6767 with the relay on. Providers: claude, codex, cursor. Cursor runs as an ACP provider (`cursor-agent acp`), is signed in to **one** Cursor account, and reports Ready (45 models; Agent/Plan/Ask modes). MCP tools are injected into agents.

## Workflow
1. **The orchestrator** (planning chat) writes self-contained briefs in `docs/tasks/<id>.md`, with each task touching **different files**.
2. **One Cursor worker per brief, each in its own worktree and branch:**
   `paseo run -d --provider cursor/<model> --title T1 --new-workspace worktree --worktree-mode branch-off --new-branch hack/t1 --base origin/main "Execute docs/tasks/t1.md. Commit on your branch. Reply with a summary and the diff stat."`
3. **Track:** `paseo ls`, `paseo wait <id>`, `paseo logs <id> --tail 50`, `paseo send <id> "..."`; approvals via `paseo permit ls` / `paseo permit allow <id>`.
4. **Merge:** the orchestrator reviews each branch diff and merges with git. Paseo doesn't merge. Then `paseo workspace archive <id>`.
5. **`paseo.json`** (committed to main) has a worktree setup script: install dependencies and copy `.env` from `$PASEO_SOURCE_CHECKOUT_PATH`. Each dev server needs its own port.
6. **Orchestrator in Paseo:** enable Settings → host → Agents → "Enable Paseo tools", then use `create_agent`, `send_agent_prompt`, `get_agent_status`, `list_agents`. Optionally install skills with `npx skills add getpaseo/paseo`.
7. **Monitoring:** `paseo schedule create --every 30m ... --max-runs N --expires-in 10h` (a fresh agent each run, UTC cron) or `paseo heartbeat create --cron` (the same agent, only inside an agent session).
8. **Phone:** `paseo pair`, or Settings → Pair Device, and scan the QR code. Treat it like a password.

## Second Cursor account (UNVERIFIED)
Add a provider entry with its own key, then `paseo reload`:
`"cursor-b": {"extends":"cursor","label":"Cursor (B)","env":{"CURSOR_API_KEY":"<key>"}}`
The key would sit in plaintext in `~/.paseo/config.json`. Test with one throwaway agent first.

## Continuing the planning chat
`paseo import <claude-session-id> --provider claude --cwd <dir>` (exists locally but is undocumented), or start a fresh agent with a handoff note. Everything durable lives in `docs/` and memory.

## Gotchas
- The Mac must stay awake.
- Fresh worktrees have no `node_modules` or `.env` unless `paseo.json` sets them up.
- Keep 2–4 concurrent workers, not a swarm.
- Expect approval prompts.
