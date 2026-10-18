# DEVLOG: Switchboard

One dated entry per merge or decision. This is the source for the README's "what the human did" and AI-disclosure sections.

## 2026-10-11 → 10-13: Pre-hackathon planning (no product code)
- **Researched the hackathon:** rules, dates, tracks, Discord. See HACKATHON.md (now on the `archive/process` branch).
- **Ran 7 councils** (about 150 independent AI advisors) over 6 ideas. The owner chose **Switchboard**. See COUNCIL.md (now on the `archive/process` branch).
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

## 2026-10-15 19:20 PT: hooks, panels, longer scenario (branch `hack/B11`)
- **Hooks:** `packages/hooks/hook.sh` is what Cursor and Claude Code run. Before an edit it runs `switchboard check` and denies on exit 2, with the import path as the reason. After an edit it records it. Claude's session start injects the briefing. Cursor still ignores that text (Day-0). Cursor also fires the Claude hook file, so the Claude script does nothing when the input has `cursor_version`. `SWITCHBOARD_OFF=1` allows every edit. Paths under `demo-repo/` are checked as the graph stores them. A live check denied `ui/LoginForm.tsx` while A held `auth/session.ts`.
- **Panels:** the server adds `/api/brief`, `/api/why`, `/api/blast`, `/api/batches`, `/api/decisions`. The page has a side column for claims, batches, decisions, and events. Clicking a file highlights its blast radius.
- **Scenario:** `npm run scenario` now also prints the three parallel batches and the why-trace `crypto.ts → A → T3 → use argon2, not bcrypt`.
- **Summary:** `summarizeBrief` calls Haiku only when `ANTHROPIC_API_KEY` is set. With no key, brief stays the graph text. No new dependency; it uses `fetch`.
- **Not built:** the with/without benchmark, the landing page, deploy, README, blog, and video. Those need a longer run or the owner.
- **Tests:** 43/43. Typecheck and lint clean.

## 2026-10-16 11:15 PT: benchmark, landing page, judge page, README (branch `hack/ship`)
- **Benchmark:** `npm run bench` runs the same edit 10 times. Agent A has claimed `auth/session.ts`. Agent B's edit deletes an import and leaves the call, so `tsc` fails if it lands. Without Switchboard: **10/10 builds broke**. With Switchboard: the check blocked the edit **10/10** times and **0/10** builds broke. Median check **1 ms**. Scripted agents, not live model sessions. The only difference is whether the edit obeys FalkorDB. Numbers are in `bench/results.json`. The landing page reads that file.
- **Pages:** `/` explains the product and shows those numbers. `/app` is the graph. `/judge` has three buttons: Conflict, Batches, Why.
- **Docs:** README (setup, model, queries, ablation, AI disclosure, what the owner directed). `docs/DEMO.md` is the shot list. `docs/blog.md` is the draft. `deploy/RUNBOOK.md` is how to serve the built app and open a tunnel. No public URL was started.
- **Not done:** the owner's voice on the video, publishing the blog, and submitting the form.
- **Goal check:** the conflict, the batches, the why-trace, and the briefing are FalkorDB queries. Memory is events, decisions, and lessons in that graph. Coordination is claims and conflicts. The demo plays from one button. The benchmark is reproducible from `npm run bench`. The owner can say: a path means two agents will collide; no path means they will not. We are inside the Friday window. The landing page and the benchmark were in the plan. The three mockups were cut because the demo was already on this layout.
- **Tests:** 43/43. Typecheck and lint clean.

## 2026-10-17 01:20 PT: UI rebuild started (owner decision)
- **Owner's decision:** keep the tested engine, rebuild all UI/UX from scratch following 9 Instagram reels (docs/UI-REELS.md, now on the `archive/process` branch). The old UI is saved at tags `archive/cursor-v1` and `archive/cursor-v1-ui-reels`. Plan in docs/UI-REBUILD.md (U1–U4, freeze Sat 10 PM).
- **U1:** Tailwind v4 + Motion + GSAP + Phosphor + Geist; one accent (signal orange). The new hero is the **real demo-repo graph drawn in code** (folder columns ui → api → auth → lib): agent A edits crypto.ts, agent B reaches for LoginForm.tsx, the 3-hop path lights up and the edit is refused. Reduced motion shows the final frame. The web tsconfig moved to Bundler resolution (Vite).

## 2026-10-17 02:15 PT: engine rebuilt, council critique, night packages (autonomous run)
- **Engine rebuild (R1–R5, merged):** every engine feature was re-implemented and re-tested in five branches. Real races were found and fixed (the atomic claim guard, gapless event seq). 22 files, 137 tests pass, typecheck clean.
- **UI:** the landing page (ASCII field, causal hero, scroll story, breakdown, Cypher reveal, proof, compare) and the dashboard `/app` (pan/zoom graph, claim rings, conflict packet animation, feed/inspect/decisions/brief tabs, Bklit charts, Kokonut status island) were rebuilt from the reels.
- **Video:** `video/` (Remotion 4) renders a 71 s explainer and a 15 s vertical short to `video/out/` (git-ignored). The tsc error shown in it is real output from the demo repo.
- **Deploy attempt:** the $0.00 .xyz checkout (promo code) reached the final page at gen.xyz but needs the owner's gen.xyz login; no account was created and nothing was paid. A Cloudflare quick tunnel serves the local server meanwhile. Quick tunnels buffer SSE, so the dashboard now polls a new `GET /api/feed?last=N` after 4 s of stream silence (verified through the public URL).
- **Council:** six blind part-councils (landing, dashboard, engine, agent integration, judging/submission, deploy) and a chair produced 8 file-disjoint packages (N1–N8), now running in parallel worktrees `../gh-night-n1..8` from a shared web-contract commit. Test graphs take an `SB_TEST_NS` suffix so the worktrees can share one FalkorDB.
- **Lint:** clean after ignoring `.claude/**` and `video/**`.

## 2026-10-17 02:50 PT: night packages merged (N1–N8)
- **Merged into ui/rebuild** in this order: N1, N7, N2, N8, N4, N3, N6, N5. One conflict (`packages/core/src/index.ts`, both N1 and N3 exported the query texts; kept N3's lines). Fixes during merge: `agents.test` seeds File nodes (claim() no longer creates them), `events.test` honours `SB_TEST_NS`, the landing Query shows N3's new `until`/`hub` columns (checked equal to `conflictQuery(3)`), and toggling batches no longer restarts the live stream.
- **Regenerated on a quiet machine:** bench (median check 0.69 ms, range in REPORT.md), replay.json, pair census, README, og.png (session.ts story; the old one still showed crypto.ts), app-conflict.png, hero GIF.
- **Public link:** now runs `SB_PUBLIC=1` (agents A–D only, paths must be in the code graph, no /api/edits). One outage: an agent's `pkill -f apps/server/src/index.ts` also killed the public server; it now runs in a restart loop and agents were told to stop processes by port only.
- **Gates:** typecheck and lint clean; 23 files, 155 tests pass; web build clean.
- **Submission form** is open (fields recorded in docs/SUBMISSION.md with draft answers).

## 2026-10-17 10:50 PT: integration review, public repo, domain
- **Integration review:** six lenses (demo runtime, public security, live data, agent integration, truth, UI), two independent skeptics per finding: 13 confirmed, 3 split, 5 refuted. Fixed: the public story is replayed whenever A's claim is missing or short (not on idle time); 64 KB body limit; the public server now runs on its own graph (`sb_public`, port 8788) so local hooks and the CLI can never write into it; second-Play narration, Cypher in replay and after a failed fetch, the replay WCC tile; the video re-cut to the session.ts / 2-import story with the real TS2339 error; wording (hub rule, "about a millisecond", no unused full-text claim, DEMO handoff step, scripted demo agents).
- **Usage limit** paused the run from about 3:20 to 9:57 AM; the quick tunnel expired meanwhile and was replaced.
- **Repo public** (owner approved): `.claude/skills` untracked (third-party), the promo code scrubbed from history with git filter-repo, `ui/rebuild` merged into `main`.
- **Domain:** the owner bought `switchboard-agents.xyz` ($0.00). It was added to Cloudflare (Free plan), a named tunnel `switchboard` serves the site and the API from 127.0.0.1:8788, and the nameservers at gen.xyz point at Cloudflare; waiting for the registry and Cloudflare to activate the zone. All links in the repo use the domain.
- **Gates:** typecheck and lint clean; 23 files, 155 tests pass; web build clean.

## 2026-10-17 11:45 PT: the reel skills, imported and run
- **Imported** into `.claude/skills/` (local, untracked): Emil Kowalski's animation-performance, improve-animations, review-animations, find-animation-opportunities, emil-design-eng and apple-design; Kokonut UI's official building-components; shadcn's official skill; ui-ux-pro-max; HyperFrames motion-graphics (anime.js and GSAP guides are in hyperframes-animation); design-taste-frontend and web-design-guidelines. The reel's own motion-studio skill is gated, so motion-doctrine and cut-the-curve stand in.
- **Run:** five audits executed those skills step by step against the live landing page and dashboard (57 items, each citing its skill rule), then two implementers applied them: landing 27/28 (hero packet accelerates into the hit, camera zooms on session.ts, verdict after a beat, one-accent glitch once, ASCII field holds still while scrolling and repaints under reduced motion, faster hover reveals, skip link, 44 px targets) and dashboard 27/29 plus 2 partly (zoom buttons work, interruptible camera, results on impact, accessible tabs, Try a claim as a real popover, skeleton loading, unused lucide components removed).
- **Gates:** typecheck and lint clean; 155 tests pass; web build clean.

## 2026-10-17 15:10 PT: blind council rating, distribution wave
- **Blind council** (FalkorDB engineer, daily agent user, contrarian, first principles, outsider; each inspected the live site and the repo): mean **63.8/100** (67, 63, 54, 64, 71). Strongest: polish and graph use. Weakest: ease of adoption (25 to 38). Top asks: distinct agent ids per editor, a live graph, refusals that coordinate instead of dead-ending, Bash writes, real scheduling instead of WCC-as-serial, fewer false blocks, packaging for anyone, honest copy, per-visitor demo graphs.
- **Shipped this wave:** a Claude Code plugin and marketplace (hooks, MCP server and a skill, bundled to run without a clone), an "Add to Cursor" link, a publish-ready npm package `switchboard-agents` (not published: needs the owner's npm login), an MCP registry `server.json`; the graph updates on every edit (one-file re-parse) and `switchboard watch` catches people's saves; FalkorDB Cloud URLs (TLS, user and password) supported; an installable web app (Add to Dock), a Connect-your-agent panel and a Reset demo button.
- **FalkorDB Cloud:** a Free instance in AWS us-west-2 was created for the owner (connection details in the git-ignored .env); a test query round trip from the laptop is about 44 ms.
- **Fix during merge:** the server now re-checks which repo a graph holds on every edit and save, so another repo parsed into a shared graph can't lose its nodes.
- **Gates:** 29 files, 197 tests pass; typecheck, lint and build clean.

## 2026-10-17 17:00 PT: live demo kit (Claude Code and Cursor on one repo, FalkorDB Cloud)
- **Cloud without copying the password:** `SB_CLOUD=1` composes the URL from `FALKORDB_CLOUD_HOST/PORT/USERNAME/PASSWORD` and wins over `FALKORDB_URL`; `SB_ENV_FILE=<path>` reads only those four keys from a .env (the project .env also sets FALKORDB_URL, SB_GRAPH and API keys meant for other things). `init --graph --port --cloud <env file>` writes that into hooks and MCP configs; no config holds a secret.
- **Demo scripts:** `npm run demo:setup | demo:start | demo:reset | demo:stop` (`scripts/demo-live.mjs`), one folder `~/switchboard-demo` for both editors, graph `sb_demo_live`, dashboard on 8790. Owner guide: `docs/DEMO-LIVE.md`.
- **Fixes found by the cloud run:** the brief query used a pattern comprehension FalkorDB Cloud rejects (session start failed and said "cannot reach FalkorDB"); now a pattern predicate, and a failed brief no longer claims Switchboard is off. The MCP `claim` tool now records waits like the edit hook, so a Claude agent that checks with `claim` first still gets the holder told and hears "free". The dashboard names a live repo and FalkorDB Cloud instead of "two scripted agents".
- **E2E:** real `claude -p` (haiku 5.5) agents against the cloud graph with Cursor driven through its exact hook commands: refusals with the import path, wait and free notices, live IMPORTS edges. `cursor-agent` is not logged in on this Mac, so no real Cursor model ran.
