# DEVLOG: Switchboard

One dated entry per merge or decision. This is the source for the README's "what the human did" and AI-disclosure sections.

## 2026-10-11 → 10-13: Pre-hackathon planning (no product code)
- **Researched the hackathon:** rules, dates, tracks, Discord. See HACKATHON.md.
- **Ran 7 councils** (about 150 independent AI advisors) over 6 ideas. The owner chose **Switchboard**. See COUNCIL.md.
- **Competitor sweep:** Nerveplane, wit, Foremerge, Agent Mail, Claude Code agent teams, graphmem. See research/SWITCHBOARD-COMPETITORS.md.
- **Wrote PLAN.md** (Fable): phases, task breakdown, risks, demo, judge Q&A.
- **Installed** OrbStack, cloudflared and the FalkorDB image; smoke-tested a variable-length path query (under 1 ms).
- **Owner decisions:** the AI briefing summary (F20, Core); the with/without benchmark (F23, Core) shown on the landing page (F24); coding in the Cursor desktop app (no Paseo); models: Opus 5.5 for the main chat, Grok 4.7 for subagents.

## 2026-10-14 23:15 PT: B0 Setup (branch `hack/B0`)
- **What changed:** an npm-workspaces monorepo (`packages/{core,mcp,cli}`, `apps/{server,web}`, all placeholders), TS 5.9 strict NodeNext, vitest 5, eslint 10 flat config, a `docker-compose.yml` for FalkorDB (6379/3000, named volume, `restart: unless-stopped`), `.env.example`, `.gitignore`, `scripts/wt.sh new|rm <id>`, and `CLAUDE.md` (imports `AGENTS.md`).
- **Who:** the brief was written by the main chat (Opus 5.5); S1 and S2 by a Grok 4.7 subagent; review, the fix below and S4 by the main chat.
- **Problems:** the Grok subagent committed both steps, then was stopped by Cursor's loop detector before reporting back; its commits were reviewed by hand. The owner's weekday-fix commit had landed on `hack/B0` as well as `main`, so the branch was rebased onto `main` (git dropped the duplicate). The package tsconfigs excluded `*.test.ts`, so tests were never type-checked; the exclude was removed.
- **Tests:** `npm test` 1/1 green; `npm run typecheck` and `npm run lint` clean; `npm run db:ping` → `RETURN 1` = 1 in 0.12 ms.
- **Environment facts for M2:** FalkorDB graph module 6.0.2 (`ver 60002`) on Redis 8.10.2. Module defaults are `TIMEOUT 1000` ms, `MAX_QUEUED_QUERIES 25` and `RESULTSET_SIZE 10000`. `dbms.components()` doesn't exist, so read the version from `MODULE LIST`. The `falkordb-learn` playground container was removed.
