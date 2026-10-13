# Paseo deep research and 4-day playbook (Oct 14-18)

Researched 2026-10-13 against Paseo 0.11.2 and cursor-agent 2026.10.01-e373342. Builds on `docs/PASEO.md` (not repeated). Read-only research; nothing was installed, paired or changed. Labels: **VERIFIED** (seen in docs or local read-only output), **UNVERIFIED** (inference or third-party), **TEST FIRST** (cheap check before relying on it).

Sources (docs): https://paseo.sh/llms.txt , https://paseo.sh/docs/orchestration.md , https://paseo.sh/docs/orchestration-workflows.md , https://paseo.sh/docs/agent-profiles.md , https://paseo.sh/docs/skills.md , https://paseo.sh/docs/custom-providers.md , https://paseo.sh/docs/plugins.md , https://paseo.sh/docs/plugins/reference.md , https://paseo.sh/docs/cli.md , https://paseo.sh/docs/worktrees.md , https://paseo.sh/docs/parallel-development.md . Issues: https://github.com/getpaseo/paseo/issues (numbers cited inline).

## 1. Orchestration best practices

What the docs say (VERIFIED):
- Orchestrator needs "Paseo tools" on (Settings > host > Agents > Enable Paseo tools; off by default) or the CLI. Workers appear in the Subagents track; the parent is notified on finish. Paseo subagents are full sessions you can talk to (unlike native provider subagents).
- Use **agent profiles** (Settings > host > Agents > Agent profiles) with a "When to use" note per profile (e.g. Planning, Implementation, Review). Orchestrator reads them via `list_profiles`; the notes guide choice, the actual assignment goes in the task prompt.
- Official example prompts (paraphrased from orchestration-workflows):
  - Implement then review: "Check my Paseo profiles and their notes for implementation and review. Create a workspace with worktree isolation and launch an implementation worker there. When it finishes, launch an independent reviewer in that workspace to check correctness, missing tests, and unnecessary complexity. Bring the review back here."
  - Parallel edits: "Split these two issues between two Paseo subagents. Create a separate workspace with worktree isolation from main for each. Check my profiles... have each run the focused checks for its change. Summarize both diffs when done."
  - Redirect: "Tell the parser worker to add the malformed-input case and rerun its test file." / "Cancel the UI worker's current turn, but keep the agent so I can redirect it."
  - Heartbeat: "create a heartbeat every 10 minutes. Continue this migration in small steps, run the focused checks after each step, delete the heartbeat when complete. Expire after two hours."
- Official "loop until done" (cli.md): an implement-then-verify shell loop; the verifier returns JSON via `--output-schema` and the loop exits when `criteria_met == true`:
  ```bash
  while true; do
    paseo run --provider codex "make the tests pass" >/dev/null
    verdict=$(paseo run --provider claude --output-schema '{"type":"object","properties":{"criteria_met":{"type":"boolean"}},"required":["criteria_met"],"additionalProperties":false}' "ensure tests all pass")
    echo "$verdict" | jq -e '.criteria_met == true' >/dev/null && break
  done
  ```
  Adapt with a **max iteration count** (no built-in cap) and a different provider/model for the verifier than the builder.
- Skills (`npx skills add getpaseo/paseo`, or Settings > Orchestration skills): `/paseo`, `/paseo-handoff` (briefing template: Task, Context, Relevant files, Current state, What was tried, Decisions, Acceptance criteria, Constraints; "receiving agent has zero context"), `/paseo-committee` (two high-reasoning agents, root cause + plan), `/paseo-advisor`. Already present locally in `~/.claude/skills/paseo*`.

How to brief and verify (synthesis, UNVERIFIED as "best practice", derived from the above):
- One brief file per worker in `docs/tasks/<id>.md` with disjoint files; worker prompt is just "Execute docs/tasks/<id>.md".
- Never accept "done". Require evidence in the final reply: commit hash, `git diff --stat`, the exact test command and its output tail. The orchestrator re-runs the check itself in the worktree (do not trust the worker's claim).
- Verify with a *different model* than the builder (docs recommend different providers for independent judgment).
- Do not poll in a tight loop: use `paseo wait <id> --timeout N`, then `paseo logs <id> --tail 40`.

## 2. Two Cursor accounts at once

Facts (VERIFIED from the installed bundle `~/.local/share/cursor-agent/versions/2026.10.01-e373342/index.js`, read-only grep; official docs are silent):
- Auth sources: `--api-key` / `CURSOR_API_KEY`, `CURSOR_AUTH_TOKEN`, or stored `agent login`. Official page: https://cursor.com/docs/cli/reference/authentication (recommends env var; does not mention multiple accounts or config dir).
- Config dir: `CURSOR_CONFIG_DIR`, else `$XDG_CONFIG_HOME/cursor`, else `~/.cursor`. (Used by the CLI; docs don't mention it.)
- Credential store env `AGENT_CLI_CREDENTIAL_STORE` = `file` | `memory` | default (macOS Keychain; Paseo issue #6458 confirms the keychain item service `cursor-access-token`). `memory` means credentials are not persisted.
- When an env API key is used, the CLI exchanges it and tries to persist credentials ("auth.apiKey.persistFailed" path). **Risk:** with the default store this could write into the shared Keychain item used by account A. UNVERIFIED either way.
- Third-party (AgentsRoom, https://agentsroom.dev/docs/multi-account.md, UNVERIFIED) claims: one config dir per account; and that a stored login silently beats `CURSOR_API_KEY`. The bundle's auth code looks like it tests the API key before the stored login, so the claims conflict. **TEST FIRST.**
- Usage limits: plan usage is a monthly dollar budget in two pools, "Cursor Models" (Composer, Grok) and "Other Models" (third-party at API rates), resetting with the billing cycle; on-demand beyond that (https://cursor.com/docs/account/pricing , https://cursor.com/help/models-and-usage/usage-limits). No doc separates CLI from editor usage; no public RPM/TPM for headless (https://forum.cursor.com/t/cursor-agent-headless-rpm/155798). Assume CLI draws from the same pool as the account; check cursor.com/dashboard/usage after a test run.

Recommended approach (most reliable first):
1. **Provider B with an API key, isolated store** (matches `docs/PASEO.md`, hardened):
   `"cursor-b": {"extends":"cursor","label":"Cursor (B)","env":{"CURSOR_API_KEY":"<key B>","AGENT_CLI_CREDENTIAL_STORE":"memory","CURSOR_CONFIG_DIR":"/Users/<you>/.cursor-b"}}`
   Then `paseo reload` (config edit is the owner's action, not done here).
2. **TEST FIRST** before any real work, outside Paseo (owner runs): `CURSOR_API_KEY=<key B> AGENT_CLI_CREDENTIAL_STORE=memory CURSOR_CONFIG_DIR=$HOME/.cursor-b agent status` must print account B's email, and plain `agent status` must still print account A. Then one throwaway `paseo run --provider cursor-b/composer-2.5 --no-wait "reply with OK"`; confirm in each account's dashboard that only B moved.
3. Fallback if the key does not take precedence: `agent login` once with `CURSOR_CONFIG_DIR=$HOME/.cursor-b AGENT_CLI_CREDENTIAL_STORE=file NO_OPEN_BROWSER=1` (log in as B), keep the same three env vars on `cursor-b`.
4. Secret hygiene: the key lives plaintext in `~/.paseo/config.json`; `chmod 600` it, never paste it into briefs or logs.
5. Balancing: assign by task, e.g. A = planning/review models, B = bulk coding. When one hits its pool, re-launch the worker on the other provider (a fresh chat, not a resume).
Paseo-side caveat: Paseo's Usage panel has per-config-dir gaps for multi-account (#3589, #6353, #6458); do not rely on it for quota.

## 3. Cursor model choice

`paseo provider diagnostic cursor --json` reports only "Models: 45" and Status Ready (no names). Names come from `paseo provider models cursor` (VERIFIED, local):
default (Auto), grok-4.7, grok-4.6, composer-2.5, claude-opus-5-5, claude-opus-5, claude-opus-4-8, gpt-5.6-sol, gemini-4-argon, gpt-5.5, claude-fable-5-1, claude-fable-5, grok-4.5, gemini-3.8-flash, gemini-3.7-flash, muse-spark-1.3, gpt-5.6-terra, claude-sonnet-5-5, claude-sonnet-5, claude-sonnet-4-6, gpt-5.3-codex, claude-opus-4-7, gpt-5.4, claude-opus-4-6, claude-opus-4-5, gpt-5.2, gpt-5.6-luna, gemini-3.6-flash, gemini-3.1-pro, gpt-5.4-mini, gpt-5.4-nano, claude-haiku-5-5, claude-haiku-4-5, claude-sonnet-4-5, gpt-5.1, gemini-3-flash, gemini-3.5-flash, claude-sonnet-4, gpt-5-mini, gemini-2.5-flash, kimi-k3, kimi-k2.7-code, glm-5.2, glm-5p3, glm-5p3-flash.

Recommendation (UNVERIFIED: judged from names and the pool structure, not benchmarked; please run one small trial per model):
- Planning-heavy / review / hard bugs: `claude-opus-5-5` (fallback `gpt-5.6-sol`). Costs from the "Other Models" pool.
- Coding-heavy default: `composer-2.5` (Cursor Models pool, so it spares the third-party budget) and `claude-sonnet-5-5` for harder tasks; `gpt-5.3-codex` as an alternate builder.
- Cheap chores (lint fixes, docs, renames): `claude-haiku-5-5` or `gpt-5.4-mini`.
- Avoid `grok-4.6/4.7` for unattended turns: the Cursor forum reports repeated stream drops on them (https://forum.cursor.com/t/unattended-work-impossible-due-to-cli-failures/173810), though Cursor staff say the retry gap is not Grok-specific.
- Parameterized models take bracket overrides on the raw CLI (e.g. `claude-opus-4-8[effort=high]`); in Paseo use agent profiles to pin model + thinking + mode.
- Suggested profiles: **Planning** (cursor-a/claude-opus-5-5, plan or agent mode), **Build** (cursor-b/composer-2.5, agent), **Review** (a different model from the builder, read-only instructions).

## 4. Moving the Claude Code chat into Paseo

- `paseo import <id> [--provider claude] [--cwd <path>] [--label k=v] [--json]` exists (VERIFIED, `--help`). `<id>` is the provider session id (for Claude: the UUID of `~/.claude/projects/<cwd-slug>/<id>.jsonl`). The official docs don't document import for Claude; Claude support itself is UNVERIFIED, and I did not run it (it creates an agent).
- Known problems: no `--mode`, so the imported agent starts in Always Ask and silently stalls on its first tool call while `paseo ls` says running; changing mode afterwards does not clear the pending request (#4731, open). Codex imports reset model/effort/mode (#6789). Sessions occasionally vanish from the import list (#2574).
- Safest path (recommended): **do not import. Start a fresh Paseo Claude agent from a handoff note.** Have the current chat write `docs/ORCH-STATE.md` (decisions, task table, branch names, open questions) and launch `paseo run --provider claude --mode <mode>` (list valid modes with `paseo agent mode <id> --list`; UNVERIFIED which suits unattended work) with "Read docs/ORCH-STATE.md and CLAUDE.md, then continue as orchestrator". The `/paseo-handoff` skill's template fits exactly.
- If you still want history: import on a throwaway test session first, immediately run `paseo permit ls` and `paseo agent mode <id> <mode>`, and send a trivial prompt that needs a tool call to see if it stalls.
- Also: Paseo's injected MCP tools may not reach a **Cursor** parent (#5091, `notifyOnFinish` lost; #3248 CLI `run` doesn't notify parent). So the orchestrator should be **Claude** (or Codex), and the Cursor agents only workers.

## 5. Plugins and hooks (VERIFIED from plugin reference)

- Plugins are trusted TypeScript projects (`paseo plugin init <abs path>`, `paseo plugin install <path>`, `paseo plugin ls`, `paseo plugin logs <id>`); need "Enable plugins" (`pluginsEnabled`, already a key in config). Unsandboxed; installing means trusting the code. Use the bundled `paseo-plugin` skill to build one.
- Server hooks run on the daemon even with no app open: `agent.created`, `agent.closed`, `agent.turn_started`, `agent.turn_ended` (outcome + timeline), `agent.permission_requested`, `agent.permission_resolved`, `agent.archived`, `workspace.created`, `workspace.archived`; plus `server.before("agent.create", ...)` to rewrite config/env/MCP/worktree choice. 30 s hook timeout.
- Mapping to your needs:
  - **Notify on completion:** `agent.turn_ended` handler that runs `osascript -e 'display notification ...'` or POSTs to ntfy.sh (phone push). Paseo's own mobile push also exists, with known gaps (iOS background suspension #2622; stale presence suppressing banners #4841).
  - **Auto-run tests after a worker finishes:** `agent.turn_ended` -> run `npm test` in the agent's workspace dir (child_process), then `context.paseo.agents.ref(id).send("Tests failed: <tail>. Fix and recommit.")` on failure. Add a retry counter (the docs warn persistent matches keep sending). Official example for follow-ups: `plugin-examples/lifecycle-actions` (https://github.com/getpaseo/paseo/tree/main/plugin-examples/lifecycle-actions).
  - **Review gate before merge:** no built-in gate. Implement as process: a worker's branch is merged only after (a) the plugin's test run is green, (b) a reviewer agent returns the schema verdict, (c) the orchestrator merges with git. A plugin could also post "needs review" when tests pass, but merging stays manual.
  - **Permissions:** `agent.permission_requested` can auto-allow safe commands and deny `rm -rf` etc. (official example). Leaves others pending for the phone.
- Cheaper alternative with no plugin: `paseo run --no-wait` + `paseo wait` in a shell script, and git hooks (pre-push / pre-merge-commit) in the repo.
- Registry: https://paseo.sh/plugins (not reviewed). UNVERIFIED whether a ready-made test/notify plugin exists.

## 6. Failure modes (GitHub issues) and workarounds

- Cursor ACP drops long turns: `[canceled] http/2 stream closed with error code CANCEL` (#5470). Cursor staff: over ACP a dropped connection ends the turn; headless `cursor-agent -p` reconnects, `--resume <chatId>`; turns over ~10 min are most exposed. Workaround: keep tasks small (<10 min), `paseo send <id> "continue"` after a drop; commit often.
- Cursor plan mode strands the plan (`cursor/create_plan` unhandled, #3645). Workaround: use agent or ask mode; have the planner write the plan to a file.
- One transient `Failed to initialize session services` blocks that cwd until the daemon restarts (#6399). Workaround: `paseo daemon restart` (owner action), or create the worker in a new worktree path.
- Cursor does not surface Paseo MCP tools; no finish notifications to a Cursor parent (#5091, #3248, #3875 `notifyOnFinish` one-shot, #5928 fast child completion missed). Workaround: Claude orchestrator, workers polled with `paseo wait`.
- Cursor thinking option mismatch on iOS (#4034) and Fast offered for models without it (#5279): pick model/thinking from the desktop or profiles.
- `kill_agent` not terminal (#5121); Stop can fail to cancel (#3256, #3749): use `paseo agent` stop/archive; if stuck, archive the workspace and relaunch.
- Daemon restarts kill active turns and drop notifications (#3061); daemon can stop responding (#4783). Do not restart mid-run.
- Worktrees: setup fails if `NODE_ENV=production` is inherited (#4614); "Setting up workspace..." forever after daemon restart (#6049); unarchive does not re-run setup (#1931); stale refspecs block fetches (#5556); `paseo.json` is read from the committed base branch, so commit it to `main` first (worktrees doc). A short first turn can push a placeholder branch via a push-on-stop hook (#5754).
- Memory: the app keeps every opened agent timeline in memory (#6477); archive finished agents.
- Mac sleep kills runs: `caffeinate -dimsu &` (owner action) or Energy settings.

## 7. Phone workflow

Facts (VERIFIED, https://paseo.sh/docs.md): pair via Settings > host > Pair Device (QR) or `paseo pair`; the relay is end-to-end encrypted; without the relay use Tailscale/VPN direct. The docs say little about phone features. The mobile app shows agents, timeline/logs and permission prompts (UNVERIFIED in detail, inferred from push-notification issues #2622, #4841 which mention permission banners). Known mobile bugs: iOS thinking UI (#4034), timeline fetch over the relay cap on image-heavy sessions (#2220), iOS push suppressed in the presence window (#2622).
Practical: enable notifications, keep agents in a permissive mode so approvals are rare, and use `paseo permit ls/allow` from a laptop terminal as the backup. Treat the QR code like a password. For logs on the phone, open the agent timeline; for long logs the laptop `paseo logs <id> --tail 60` is more reliable.

## 8. Operating playbook

### Setup checklist (Day 0, Oct 13)
1. Commit `paseo.json` to `main` (worktree setup: install deps, copy `.env` from `$PASEO_SOURCE_CHECKOUT_PATH`; unique dev-server port per worktree). It is not present yet (`ls` showed none).
2. Test account B per section 2 (owner runs the `agent status` check; add `cursor-b`; `paseo reload`).
3. Create profiles Planning / Build / Review with "When to use" notes. Enable Paseo tools; install skills.
4. Decide orchestrator: fresh Claude agent in Paseo from `docs/ORCH-STATE.md`, not `import`.
5. Throwaway worker test: `paseo run --provider cursor/composer-2.5 --no-wait --new-workspace worktree ...`, then `paseo wait`, `paseo logs`, `paseo permit ls`, archive it. Confirm worktree setup ran.
6. Pair phone, send a test permission. Optional: notify plugin on `agent.turn_ended`.
7. Keep the Mac awake and plugged in.

### Daily loop
1. Morning: `paseo ls -g`; archive finished agents; `git fetch`; pick 2-4 independent tasks (disjoint files) and write `docs/tasks/<id>.md` each.
2. Launch (no `-d`; it is deprecated):
   `paseo run --no-wait --quiet --provider cursor/composer-2.5 --title T1 --new-workspace worktree --worktree-mode branch-off --new-branch hack/t1 --base origin/main "Execute docs/tasks/t1.md. Follow the worker rules in it."` (use `cursor-b/...` for half the workers).
3. Monitor: `paseo wait <id> --timeout 600`, `paseo logs <id> --tail 40`, `paseo permit ls`. Optional `paseo schedule create --every 30m --max-runs N --expires-in 10h` status agent.
4. On finish: run the review/merge gate (below). Merge one branch at a time, rebase the others on main.
5. Evening: update `docs/ORCH-STATE.md` (state, next tasks, blockers); archive workspaces; check both Cursor dashboards for pool use.

### Worker prompt template (`docs/tasks/<id>.md`)
```
## Task
<imperative, one outcome>
## Context
<why; links to docs/HACKATHON.md sections>
## Files you own (touch only these)
- path -- purpose
## Files you must NOT touch
- ...
## Acceptance criteria
- [ ] <observable, testable>
## Verify (run before replying; paste output tails)
- <exact test/lint/build command>
## Rules
- Work only in this worktree/branch. Small commits. No new dependencies unless listed.
- Stop and reply BLOCKED (with the question) instead of guessing. If no progress after 2 attempts at the same error, stop and report.
- Keep this turn under ~10 minutes of work; commit and report partial progress rather than continuing.
- Never print or write secrets.
## Final reply format
Branch, commit hashes, `git diff --stat`, verify command + result, what is NOT done, risks.
```

### Review / merge gate
1. `git -C <worktree> log --oneline main..HEAD` and `git diff --stat origin/main...HEAD`: scope matches "files you own"? Any stray files, lockfile churn, secrets? If not, send back.
2. Orchestrator re-runs the verify command itself in the worktree (do not trust the worker's report).
3. Independent reviewer: a different model, read-only prompt ("DO NOT edit files; review correctness, missing tests, unnecessary complexity, scope creep; return JSON {approve:boolean, issues:[...]}") via `paseo run --output-schema ...`.
4. Approve only if tests green AND reviewer approves AND diff in scope. Then merge via git (`--no-ff` or squash), re-run tests on main, archive the workspace. Anything failed: send the exact failing output back to the same worker with `paseo send`, max 2 rounds.
(Optionally automate steps 2-3 with the `agent.turn_ended` plugin; the merge itself stays manual.)

### When a worker is stuck
1. `paseo logs <id> --tail 60` and `paseo permit ls` (a pending permission is the most common silent stall).
2. Dropped turn (`CANCEL`/`unavailable`): `paseo send <id> "Continue from where you stopped; check git status first."`
3. Same error twice: cancel the turn (keep agent), send a narrower instruction, or lower scope; consider switching model (e.g. composer-2.5 -> claude-sonnet-5-5) or provider (a/b).
4. Still stuck after ~15 min: commit what exists, archive, relaunch a fresh worker with a brief that includes "what was tried". Use `/paseo-committee` for hard root-cause problems.
5. Provider error persists for a cwd (#6399): new worktree path; last resort daemon restart (kills running turns, so only when idle).
6. Quota hit on one account: relaunch on the other provider.
