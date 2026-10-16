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

## 2026-10-15 00:10 PT: B1 Day-0 tests (branch `hack/B1`)
- **What changed:** `scripts/probe.sh` is one hook script for both editors. It logs to `/tmp/sb-hooks.log`, allows everything, and denies edits of `probe/BLOCKED.md`. `scripts/mcp-echo.ts` is a zero-dependency stdio MCP server with one tool, `sb_echo`. Both are registered in `.cursor/hooks.json`, `.claude/settings.json`, `.cursor/mcp.json` and `.mcp.json`.
- **Who:** the main chat (Opus 5.5) wrote the probes and ran the tests from the Cursor side and through headless Claude Code (`claude -p`, Haiku). The owner ran the fresh Cursor chat steps.

| Check | Cursor IDE 2026.10 | Claude Code 2.1.300 | Evidence (`/tmp/sb-hooks.log`) |
|---|---|---|---|
| Hook fires before an edit | ✅ `preToolUse`; every edit tool reports `tool=Write` + `file_path` | ✅ `PreToolUse` (`Edit`) | `cursor preToolUse tool=Write file=…` / `claude PreToolUse tool=Edit …` |
| **Hard-block an edit** | ✅ denied; the agent saw our reason text | ✅ denied; the agent reported the reason and didn't retry | `DENY cursor …/BLOCKED.md`, `DENY claude …/BLOCKED.md`; file unchanged |
| Hook fires after an edit | ✅ `afterFileEdit` | ✅ `PostToolUse` | both lines present |
| Shell hook | ✅ `beforeShellExecution` | not tested | |
| Session-start hook runs | ✅ runs | ✅ runs | `cursor sessionStart` 00:04:39, `claude SessionStart` 00:02:30 |
| Session-start **context injection** | ❌ the output is ignored; the canary never reached the agent | ✅ the agent quoted the canary word | owner's fresh-chat test; `claude -p` answer |
| Project MCP tool callable | ✅ after enabling `sb-echo` in Settings → Tools & MCP | ✅ loaded from `.mcp.json`, headless, no prompt | `tools/call sb_echo text="hi"` (cursor-vscode), `text="hello from claude"` |
| Subagents covered by project hooks | ✅ the B2/B3 workers' writes in `../gh-B2` and `../gh-B3` hit the hooks | n/a | `cursor preToolUse … gh-B3/…/schema.ts` |
| FalkorDB `algo.WCC`, `algo.pageRank` | ✅ WCC → batches `[t1,t2]`, `[t3]`; PageRank ranks the most-imported file first | | graph module 6.0.2 |

- **Surprises:**
  1. Cursor also runs Claude Code's hooks from `.claude/settings.json`, so every Cursor edit and session start fired both configs at the same second. Both denied BLOCKED.md.
  2. FalkorDB rejects `shortestPath` inside `MATCH` ("only supports shortestPaths in WITH or RETURN clauses"). `MATCH (a…),(b…) WITH shortestPath((a)-[:IMPORTS*..3]->(b)) AS p RETURN …` works, and returns `null` when there is no path.
- **Decisions (the owner should confirm; PLAN not yet edited):**
  - **F12 Cursor deny moves from Stretch to Core.** Both editors can hard-block a conflicting edit. The demo can show the block in Cursor as well as in Claude Code.
  - **Workers use the MCP tools** (they work in both editors). The CLI stays as the surface the hooks call.
  - **Briefing delivery:** Claude Code uses its `SessionStart` hook. Cursor ignores `sessionStart` output, so a Cursor rule says "call `brief_me` first" (the MCP tool). Don't rely on the hook there.
  - **B11 must avoid running hooks twice in Cursor.** Planned approach: the Claude-side hook exits early when the input carries Cursor's `cursor_version` field (verify that field in B11). The alternative is to ship only one config per editor.
  - **B5 (Q1):** compute `shortestPath` in `WITH`, not `MATCH`. Hand this note to the conflict-query brief.
- **Tests:** `npm test` 1/1; lint clean.

## 2026-10-15 00:25 PT: B3 Core graph (branch `hack/B3`)
- **What changed:** `core/graph.ts` connects to FalkorDB and has `query`/`roQuery` wrappers with a 2 s timeout and no Cypher of its own. `queries/schema.ts` creates the indexes and the `Meta` seq counter, and is idempotent. `queries/events.ts` holds `ALLOCATE_EVENT` + `recordEvent`, where one write query bumps the seq and creates the Event with its optional BY/ON/UNDER links. `queries/feed.ts` is Q8 (`feedSince`, `latestSeq`) and `queries/edits.ts` is the Q7 write half. New dependency: `falkordb@^6.8.0` (the official client).
- **Who:** Grok 4.7 subagent in worktree `../gh-B3`. It stalled once (Grok-side, no stuck process) and was resumed. The main chat reviewed it, rebased it onto main and re-ran every check.
- **Proof the graph is the bus:** 20 concurrent `recordEvent` calls return seqs exactly 1..20, because FalkorDB serialises writes per graph and the bump and CREATE are one query.
- **Deviation:** full-text indexes use `CREATE FULLTEXT INDEX FOR (d:Decision) ON (d.text, d.why)`, because FalkorDB 6.0.2 rejects the plan's `db.idx.fulltext.createNodeIndex(label, prop, prop)` ("expected at most 1 argument").
- **Tests:** `npm test` 8/8 twice in a row; typecheck and lint clean.

## 2026-10-15 00:35 PT: B2 Demo repo (branch `hack/B2`)
- **What changed:** `demo-repo/` is a 35-file synthetic "team notes" TS app with no dependencies and no JSX. The planted traps: the chain `ui/LoginForm.tsx → api/login.ts → auth/session.ts → lib/crypto.ts`; the hub `lib/utils.ts`, imported by 20 files; 4 `@lib/` alias imports; 3 type-only imports; `ui/AboutPage.tsx` with no dependents; and an independent settings island (`ui/SettingsPanel.tsx → api/settings.ts → lib/prefs.ts`). The ground truth for the B4 parser test is in `demo-repo/expected.json` (35 files, 51 import edges).
- **Who:** Grok 4.7 subagent in `../gh-B2`. It stalled once and was resumed. The main chat verified every count with an independent import resolver.
- **Bug caught in review (it was in the brief):** the island reached the login chain in 2 hops through `lib/types.ts` (`SettingsPanel → types ← LoginForm`) via type-only imports. Q3's undirected interference check would have merged both tasks into one batch and broken the "safe to run in parallel" demo. Fix: `Preferences` moved into `lib/prefs.ts`. Now no island↔chain path of 3 hops or fewer exists without going through the hub.
- **Tests:** `npx tsc -p demo-repo` exit 0; `npm test` and lint green.

## 2026-10-15 10:30 PT: B4 Parser + loader (branch `hack/B4`)
- **What changed:** `core/parser.ts` (`parseRepo`) uses ts-morph to turn a repo into files (`path, lang, loc, sha1`) and file→file imports (`specifiers`, `typeOnly`). It loads the repo's tsconfig for aliases only and adds files by glob, so it also parses repos whose root tsconfig doesn't list every file. `core/queries/loader.ts` (`loadParse`) makes three batched `UNWIND … MERGE` passes (files; clear the outgoing imports of re-parsed files; imports) and then records a `parse` event. `scripts/parse.ts` gives `npm run parse -- <dir>`.
- **New dependencies:** `ts-morph@^28` (the parser, as in PLAN §2) and `tsx` as a root dev dependency (it runs TS scripts whose imports use `.js` paths; Node's built-in type stripping can't, and the CLI and server need it in dev too).
- **Design note:** new File nodes get `hub=false, rank=0.0`. A missing `hub` would be null, `NOT null` filters the row out, and Q1/Q2 would silently drop every file.
- **Who:** the main chat (Opus 5.5), with no subagent.
- **Tests:** `npm test` 19/19 (6 parser tests against `expected.json`; 5 loader tests on a real FalkorDB: counts, the 3-hop path in Cypher, `NOT f.hub`, idempotent reload, a removed import is dropped). Typecheck and lint clean. Live: demo-repo parses and loads in ~0.33 s; our own repo gives 60 files and 81 imports.

## 2026-10-15 10:30 PT: B5 Conflict query Q1 (branch `hack/B5`)
- **What changed:** `queries/conflict.ts` is Q1: SAME / UPSTREAM / DOWNSTREAM, hubs skipped on multi-hop, shortest path per (file, other agent). `queries/claims.ts` is `claim` (check then write) and `release`. One write query for the claims + event; a conflict writes no CLAIMS edge and records a `conflict` event with the paths.
- **Why not shortestPath():** B1 found FalkorDB only allows it in WITH/RETURN and it can't carry a hub filter. With k ≤ 4 we enumerate the paths and pick the shortest in TS. `k` is inlined (Cypher can't take a variable-length bound as a parameter) and validated to 1..4.
- **The hero test:** A claims `lib/crypto.ts`, B claims `ui/LoginForm.tsx` → CONFLICT UPSTREAM, path `LoginForm → login → session → crypto` (3 hops). Unrelated files and the settings island return empty (provably safe). Same file is hop 0 even for the hub. Own claims and expired claims never conflict.
- **Speed:** Q1 round-trip on `sb_demo`, 50 runs: median **0.44 ms**, p95 0.55 ms.
- **Who:** main chat (Opus 5.5). **Tests:** 27/27; typecheck and lint clean.

## 2026-10-15 10:35 PT: B7 Server + web canvas (branch `hack/B7`)
- **What changed:** `queries/snapshot.ts` reads files, IMPORTS, agents and active CLAIMS for the canvas. Hono server (`npm run server`, :8787) exposes `GET /api/graph`, `/api/claims`, `/api/events` (SSE, polls seq every 500 ms) and `POST /api/claims` so the demo can be driven without MCP. Vite+React+Sigma canvas (`npm run web`, :5173) loads the snapshot and lights `conflict` paths in red.
- **New deps:** `hono` + `@hono/node-server` (server); `react` 18, `sigma` 4, `graphology`, `vite` (web). No `@react-sigma/core` — Sigma is created in a ref.
- **Live check:** `GET /api/graph` → 36 nodes (35 files + agent A). POST A claims `lib/crypto.ts`, POST B claims `ui/LoginForm.tsx` → `{ ok:false, conflicts:[{ type:UPSTREAM, hops:3, path:[LoginForm, login, session, crypto] }] }`.
- **Tests:** 29/29; typecheck and lint clean; `vite build` succeeds.

## 2026-10-15 10:50 PT: B6 MCP + CLI (branch `hack/B6`)
- **What changed:** `queries/agents.ts` is `registerAgent`, `heartbeat` (one write each) and `status` (read-only). `agentId()` is `SB_AGENT` or the git branch. Stdio MCP (`packages/mcp`, tools register_agent / claim / release / heartbeat / status) and CLI `switchboard parse|claim|release|check|edited`. `check` does not write a claim: exit 2 + import path, or exit 0. `.cursor/mcp.json` and `.mcp.json` gained a `switchboard` server next to `sb-echo`.
- **New deps:** `@modelcontextprotocol/server@^2.3.1` (SDK v2) and `zod@^4` (tool inputSchema). No CLI framework.
- **Who:** Grok 4.7 in `../gh-B6`. Main chat rebased onto B7 (conflicts in `index.ts`, `package.json`, lockfile) and re-ran every check.
- **Proof:** `check ui/LoginForm.tsx --agent B` after A claims `lib/crypto.ts` exits 2 with `CONFLICT UPSTREAM … LoginForm → login → session → crypto`. AboutPage and the same check after release exit 0.
- **Tests:** 34/34; typecheck and lint clean.

## 2026-10-15 16:25 PT: B8 MVP scenario + tag v0.1-mvp (branch `hack/B8`)
- **What changed:** `scripts/scenario.ts` / `npm run scenario` replays demo beats 1–2 against a live FalkorDB: parse demo-repo (35 files / 51 imports), mark `lib/utils.ts` hub, register A (cursor) and B (claude), A claims `auth/session.ts`, B claims `ui/LoginForm.tsx` → CONFLICT UPSTREAM, path `LoginForm → login → session`. Releases A/B first so it is re-runnable. Two tests on `sb_test_scenario`.
- **Live run:** `npm run scenario` printed that path (seq 13 on `sb_demo`). `npm test` 36/36.
- **Goal check (§17.8):**
  1. **Graph essential:** yes. Claim, conflict path, event feed and canvas snapshot are FalkorDB queries. Remove the database and every headline feature stops.
  2. **Track fit:** episodic memory (Event seq bus) and coordination (claims, conflicts, TTL) are in. Per-project tenancy is `SB_GRAPH`. Semantic (Decision), procedural (Lesson), handoff, WCC batches and briefing are not built yet (P2).
  3. **Differentiation:** still true — a claim is checked against a *parsed* import graph, not a filename lock. The positioning line's "decisions, lessons and history in the same graph" is the model; only history (events) is populated so far.
  4. **Demo:** beats 1–2 run end to end via the script (and the canvas can show the same POST). Beats 3–6 (WCC, decision, kill/resume, why) are missing.
  5. **Proof:** 36 tests against a real FalkorDB; `npm run scenario` is the replay. No benchmark yet.
  6. **Explainability:** Q1 in two sentences — for each requested file, find another agent's unexpired claim on that file or within k import hops either way, skipping hubs; empty result means the claim is safe and is written.
  7. **Schedule:** corrected P1 exit is Fri 10 AM; it is Thu 4 PM. Ahead. P2 (B9+) starts now.
  8. **Drift:** `POST /api/claims` (demo without MCP), `CREATE FULLTEXT INDEX` instead of the plan's procedure, path enumeration instead of `shortestPath`, `Preferences` moved into `lib/prefs.ts`. All serve the goal.

## 2026-10-15 17:15 PT: B9 queries (branch `hack/B9`)
- **What changed:** five Cypher modules. `hubs.ts` runs `algo.pageRank` and sets `hub` when a file is imported at least 10 times (`lib/utils.ts`, in-degree 20). `loadParse` calls it, so the flag is not set by hand anymore. `blast.ts` lists who imports a file, hop by hop. `schedule.ts` rebuilds `INTERFERES` (paths through hubs do not count) and splits open tasks with `algo.WCC`. `why.ts` walks edit → agent → task → decision. `brief.ts` collects claims, decisions, lessons, recent events, open tasks, and the latest handoff for a task or a directory.
- **Proof:** blast of `session.ts` is `login.ts` (1) and `LoginForm.tsx` (2); `AboutPage.tsx` has no dependents. Five tasks become three batches: login+session, settings+prefs, about alone. `why(crypto.ts)` returns "use argon2, not bcrypt". A briefing for task T1 includes the claim, that decision, the lesson, and the handoff note.
- **Tests:** 42/42. Typecheck and lint clean.

## 2026-10-15 17:25 PT: B10 tools (branch `hack/B10`)
- **What changed:** the B9 queries are callable. MCP tools: `record_decision`, `record_lesson`, `brief_me`, `why`, `blast_radius`, `plan_task`, `parallel_batches`, `handoff`. The CLI mirrors them: `decide`, `lesson`, `brief`, `why`, `blast`, `plan`, `batches`, `handoff`. A new decision supersedes an older active decision on the same file. `edited --task` links the edit to that task so `why` can follow it.
- **Tests:** 43/43. CLI covers blast of `session.ts`, two tasks in different batches, and decide + edited + why for argon2.
