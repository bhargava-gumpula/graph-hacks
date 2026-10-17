# Switchboard: build plan (Graph Hacks, Oct 14–18 2026)

Written 2026-10-13 (planning only; no product code before Tue 11:31 AM PT). Sources for every tooling claim are in §18. Labels: **VERIFIED** (read in official docs or local output today), **UNVERIFIED** (forum, inference, or not testable before the start). Anything UNVERIFIED that the plan depends on has a Day-0 test in §5 P0.

Inputs: HACKATHON.md, COUNCIL.md (Council 3 "best version"), research/SWITCHBOARD-COMPETITORS.md, research/IDEA-RESEARCH.md §1.

> **Rules check (2026-10-13 evening, site + WeMakeDevs Discord):** the deadline is confirmed as Sun Oct 18, 11:29 AM PDT. Judged projects get a **public score and written feedback**, and the judges will be listed on the site. No rubric yet. The submission form opens at the start, so its fields and any video length limit are unknown: have Aside check it at 11:31 AM Tue. Details are in HACKATHON.md.

---


> ## ⚠️ CORRECTED SCHEDULE (2026-10-14, 11 PM PT): this overrides every day name below
> The original plan mislabelled the weekdays. **Oct 14 is a Wednesday and the deadline, Oct 18, is a Sunday.** The hackathon has been open since **Wed Oct 14, 11:31 AM PT**, and **no code was written on day 1** (planning finished at about 11 PM). Use **this table**, not the day names in §5–§14:
>
> | Phase | New window (PT) | Exit / tag |
> |---|---|---|
> | P0 Setup (B0, B1) | Wed Oct 14 night (if awake) or **Thu Oct 15, 8–10 AM** | `v0.0-setup` |
> | P1 MVP (B2–B8) | **Thu Oct 15, 10 AM → Fri Oct 16, 10 AM** | `v0.1-mvp` + goal check |
> | P2 Core (B9–B16, incl. AI summary + benchmark) | **Fri Oct 16, 10 AM → Sat Oct 17, 10 AM** (benchmark runs Sat early morning) | `v0.2-core` + goal check |
> | Mockups (B17) | Fri Oct 16 evening | owner picks one |
> | P3 Visual polish + landing (B18–B20) | **Sat Oct 17, 10 AM → 9 PM** | `v0.3-polish` + goal check, **FEATURE FREEZE Sat 9 PM** |
> | P4 Ship (B21–B23): deploy, README, blog, video | **Sat Oct 17, 9 PM → Sun Oct 18, 9 AM** | `v1.0` |
> | P5 Submit (B24) | **Sun Oct 18, by 10:30 AM PT** (hard deadline 11:29 AM) | `v1.0.1` |
>
> **Domain:** buy it **Fri Oct 16 evening**. **Owner sleep:** about 1–8 AM each night. A missed day is recovered by compressing P1 (bundle in bigger Opus tasks) and applying the §7 cut lines early. Don't skip the goal checks.

> **Cursor agents: start at §17 (execution manual, current state, models, worktrees, goal checks). Owner: start at §0.**

## 0. Start here: everything a newcomer needs to know

Read this section first. After it you should know as much as the owner and the orchestrator do. Everything else in this file is the detailed plan.

### 0.1 The hackathon in 60 seconds
- **Graph Hacks: Context for AI Agents**, run by **WeMakeDevs** (Kunal Kushwaha's developer community) and sponsored by **FalkorDB** (an open-source, in-memory graph database queried with Cypher). Online, free, about 3,000 registrants. The owner is registered.
- **When:** starts **Wed Oct 14, 11:31 AM PT**; submissions close **Sun Oct 18, 11:29 AM PT** (11:59 PM IST, which is the official time). Luma's times are wrong; ignore them.
- **Prizes:** one per track:
  - Agents That Act on Connected Data: iPhone 18 Pro
  - **Agent Memory and Coordination: PS5 + GTA VI (our main track)**
  - Company Brain: M6 Mac Mini

  Plus AirPods 5 for the best blog post, and t-shirts for the top 50. One project can enter several tracks.
- **Judging:** no rubric has been published. Every judged project gets a **public score and written feedback**, and the judges will be listed on the site.
- **The rules that shape everything** (full text in HACKATHON.md):
  1. **FalkorDB must be central:** "if the product still works once FalkorDB is taken out, the graph is decoration."
  2. **No main coding before the start.** Before it, only notes, sketches and diagrams are allowed.
  3. **AI coding tools are allowed but must be disclosed.** The owner must be able to explain the graph model, the queries, the architecture and the decisions. "Entirely AI-generated" projects may be rejected.
  4. **Data must be public, synthetic or our own.**
  5. **Submission needs:**
     - a public repo
     - a README with setup + graph model
     - the Cypher queries
     - a demo video
     - a live deployment (preferred) or local setup
     - the tracks named

### 0.2 Who is building, and with what
- **One builder (the owner)**, directing AI agents. Roles:
  - **Orchestrator:** a Claude chat that plans, writes task briefs, reviews and merges. It doesn't write product code.
  - **Workers:** **Cursor agents in the Cursor desktop app** (two Cursor accounts). Paseo is **not used** (owner decision, Oct 14). Since Oct 14 the main Cursor chat (Claude Opus 5.5) also acts as orchestrator, following §17.
  - **Aside:** browser tasks such as dashboards, Discord and forms.
  - **Composio CLI:** app integrations (installed; GitHub, Gmail, Notion, Discord and others connected).
- **Budget:** $100 of Claude API credits, for the product's runtime only. The coding agents run on the Cursor subscriptions.
- **Machines:**
  - **Dev Mac:** OrbStack/Docker, FalkorDB image, cloudflared installed and smoke-tested.
  - **Spare Mac:** the demo host, exposed through a Cloudflare Tunnel on the owner's **.xyz** subdomain. Buy it Thursday evening.
- **Repo:** `~/Projects/graph-hacks` → github.com/bhargava-gumpula/graph-hacks. Private now; make it public at submission.

### 0.3 How we chose Switchboard (so nobody re-litigates it)
- **We tested ideas with "councils":** 5 independent AI advisors per idea (Contrarian, First Principles, Expansionist, Outsider, Executor), each seeing only one idea, doing real web research and estimating the chance of winning. That was about 7 councils and roughly 150 advisor runs in total (COUNCIL.md has every result).
- **Ideas tested** (average win estimate):
  - Maintainer Brain (~9%)
  - npm blast radius (~9%)
  - rfc-brain / Standards Brain (~10–11%; dropped because the owner disliked it)
  - Tool Atlas (~8%; MCP tools mostly don't declare output types, so its planner would run on made-up data)
  - **Switchboard (~8%, the owner's choice).**
- **Calibrated advisors never rated any single entry above about 10–11%** among 100–300 real submissions. Treat about 10% as a good outcome, not a failure.
- **Why Switchboard won the tie:**
  - its dependency data is real (parsed from code)
  - the owner lives this problem daily (running many agents)
  - it can coordinate its own build (dogfooding)
  - it fits the PS5 track
  - the owner can explain every design choice

### 0.4 The problem, in plain English
When several AI coding agents work on one codebase, they (a) forget everything when a session ends, (b) step on each other: one changes a function another agent's code depends on, and nothing warns them, and (c) can't explain *why* code looks the way it does. Today people work around this with separate git worktrees, notes files and a human relaying messages. Switchboard is the shared brain that fixes all three, with the code's real dependency graph at its centre.

### 0.5 Competitors and our edge (details: research/SWITCHBOARD-COMPETITORS.md)
- **Every piece exists somewhere; the combination doesn't.** No tool checks agents' claims against a parsed code dependency graph *and* keeps decisions, lessons and agent history in the same graph database.
- **Closest threats:**
  - **Nerveplane:** parallel batches plus a decision log, but with hand-declared scopes and SQLite.
  - **wit:** warns about callers of a locked symbol, but advisory only, no memory, SQLite.
  - **The bundle "Claude Code agent teams + Foremerge + a lock MCP":** the hardest judge question.
  - **`graphmem`:** another Graph Hacks entrant doing FalkorDB shared memory for coding agents. We beat it on dependency-aware conflicts and scheduling.
- **Others:** MCP Agent Mail, Befall, Junto, CoordMCP, Beads, claude-flow and Graphiti MCP are memory or locks without a dependency graph.
- **Positioning line:** *Switchboard is the only tool that checks agents' edit claims against a parsed code dependency graph and keeps decisions, lessons and agent history in the same FalkorDB graph. It warns before a collision, computes which tasks can safely run together, and briefs a replacement agent on what happened and why.*

### 0.6 Decisions already made (owner, Oct 13–14)
| Topic | Decision |
|---|---|
| Idea | Switchboard |
| Main track | Agent Memory and Coordination; second entry: Agents That Act on Connected Data |
| Name | Switchboard |
| Coding | **Cursor desktop app only (no Paseo).** Main chat: Claude Opus 5.5 (orchestrator, review, merge). Subagents and small tasks: Grok 4.7. Big tasks: Opus 5.5. See §17 |
| Video | Owner's voice |
| Blog | Any public platform (dev.to or Hashnode proposed) |
| Domain | Owner buys the .xyz subdomain Thursday evening |
| AI inside the product | **Yes (owner, Oct 14):** F20, a plain-English Claude summary on top of the graph briefing (Haiku, capped, cached). The graph stays the source of truth. |
| Benchmark (with/without Switchboard) | **Yes (owner, Oct 14):** Core feature F23. Same task 10× without vs 10× with (5× each if Thursday runs late). The results go on the **landing page** (F24), the README and the video. |

### 0.7 Where everything lives
| File | What |
|---|---|
| `docs/PLAN.md` | This plan |
| `docs/HACKATHON.md` | Rules, dates, submission checklist, rules check, installs |
| `docs/COUNCIL.md` | Every council and its scores, and why each idea lost |
| `docs/research/SWITCHBOARD-COMPETITORS.md` | Competitor matrix |
| `docs/research/IDEA-RESEARCH.md` | Past FalkorDB winners and what judges rewarded |
| `docs/STATUS.md`, `docs/DEVLOG.md`, `docs/BLOG-LOG.md` | Live task tracker, engineering log, and blog material logged as we go (§17) |
| `docs/tasks/` | One brief per Cursor task (written by the orchestrator) |
| `docs/DEVLOG.md` | Created in P0: every step, decision, failure and fix |

### 0.8 Glossary
- **Claim:** an agent declares "I'm about to edit X". Switchboard checks it against the graph.
- **Dependency path:** the chain of imports or calls linking two files, e.g. `LoginForm.tsx → useAuth.ts → session.ts`.
- **Blast radius:** everything that depends on a file, hop by hop.
- **WCC (weakly connected components):** a graph algorithm that splits tasks into groups that don't touch each other. Each group can run in parallel safely.
- **PageRank hubs:** heavily imported files (like `utils.ts`), excluded from multi-hop warnings so they don't trigger alarms everywhere.
- **Briefing:** what a fresh agent receives when it starts or replaces a killed agent: relevant claims, decisions, lessons and recent edits, ranked by graph distance.
- **Why-trace:** the path File → Edit Event → Task → Decision → Agent that explains a change.
- **MCP:** Model Context Protocol, the standard way AI agents call external tools. **Hooks:** scripts the editor runs before or after an agent's edit (Claude Code `PreToolUse`, Cursor `afterFileEdit`).
- **Worktree:** a separate checkout of the repo on its own branch, so parallel agents don't overwrite each other.
- **Tag:** a named git snapshot at the end of each phase. Each one is submittable and is the rollback point.

---

## 1. The product

**One paragraph.** Switchboard is a shared brain for a team of AI coding agents working on one repository. It parses the code into a dependency graph in FalkorDB (files, symbols, imports, calls), and every agent, whether Cursor or Claude Code, checks in through MCP and editor hooks: it claims what it is about to edit, records decisions and lessons, and logs what it changed. Because claims live in the same graph as the code's dependencies, Switchboard warns an agent *before* it edits a file that another agent's in-flight change depends on (or that depends on another agent's change), and shows the exact dependency path. The same graph tells an orchestrator which tasks are safe to run in parallel (connected components over the interference graph), briefs a fresh agent that replaces a killed one, and answers "why does this code look like this?" with the path from the file back through the edit, the task, the decision and the agent that made it.

**Tracks:** main = Agent Memory and Coordination (PS5). Second = Agents That Act on Connected Data (graph queries and algorithms are the agent's tools; the graph decides).

**The one graph-native move (what the judges' recap writers look for):** a *claim* is checked by a path query against a *parsed* dependency graph, and "no path" is the proof that two agents cannot collide. A flat lock table cannot express that; Nerveplane hand-declares scopes; wit checks one hop.

### Features

| # | Feature | Tier | Notes |
|---|---|---|---|
| F1 | Parse a TS/JS repo into File nodes + IMPORTS edges (ts-morph) | **MVP** | Idempotent `UNWIND … MERGE` loader; re-parse on demand |
| F2 | `claim(paths, task)` MCP tool: OK, or CONFLICT with the dependency path and the other agent | **MVP** | File-level claims, TTL, same-file + up to 3 import hops, both directions |
| F3 | `release`, `register_agent`, `heartbeat` | **MVP** | Agent id defaults to the git branch of the cwd |
| F4 | Live graph canvas: files, imports, agents, claims; conflict path lit in red | **MVP** | Sigma.js + graphology, SSE fed by polling Event.seq |
| F5 | Event log (episodic memory): every tool call and edit is an Event node | **MVP** | Append-only, `seq` counter |
| F6 | Demo repo: a small synthetic TS app (~35 files) with a planted 3-hop conflict | **MVP** | Public, our own data (rule: public/synthetic) |
| F7 | `record_decision(text, why, affects)` + `SUPERSEDES` (semantic memory) | **Core** | |
| F8 | `record_lesson(text, about)` (procedural memory) | **Core** | "run codegen before tsc" style |
| F9 | `brief_me(area)` ranked by graph distance: claims, decisions, lessons, recent edits, open tasks, last handoff note | **Core** | The kill-and-resume moment |
| F10 | `why(path)` trace: File → Event → Task → Decision → Agent, path returned and drawn | **Core** | |
| F11 | Claude Code hooks: PreToolUse deny on conflicting Edit/Write (hard block), PostToolUse logs edits, SessionStart injects the briefing | **Core** | VERIFIED capability |
| F12 | Cursor hooks: `afterFileEdit` logs edits (+ late-collision flag), `sessionStart` injects briefing; `preToolUse(Write)` deny if it works over ACP | **Core** (deny part: Stretch) | CLI/ACP support UNVERIFIED; Day-0 test |
| F13 | Blast radius: dependents of a file by hop, "no dependents = provably safe" | **Core** | Hero of the Connected Data entry |
| F14 | Parallel-safe scheduling: `INTERFERES` edges between tasks, then `algo.WCC` → batches | **Core** | Graph algorithm on screen |
| F15 | Hub files via `algo.pageRank` on IMPORTS; hubs don't trigger multi-hop warnings | **Core** | Answers "every file imports utils" |
| F16 | Symbol-level graph: Symbol nodes, DEFINES, CALLS (ts-morph references) and symbol claims | **Polish** | Cut first if parsing is flaky |
| F17 | Cypher-on-screen panel: each warning shows the query that produced it | **Polish** | Rule 12 and judge trust |
| F18 | Replay mode: a seeded scenario script drives the MCP tools; the UI animates it | **Polish** | Also the static fallback for the live site |
| F19 | `handoff(task, note)` and `next_task()` for the orchestrator | **Polish** | |
| F20 | Claude Haiku plain-English summary on top of each briefing (the only LLM in the product; capped and cached) | **Core** | Owner approved Oct 14. Built after F9 works; the graph result is shown underneath as evidence |
| F21 | Multi-project tenancy: one FalkorDB graph per project (`sb_<slug>`), project switcher in UI | **Core** (model) / Polish (UI) | Multi-graph is native |
| F22 | Second language (Python via tree-sitter) | **Stretch** | Not for this week |
| F23 | **With/without benchmark:** a script runs the same multi-agent task N× without and N× with Switchboard on the demo repo, counting broken builds, failing tests, overwritten edits and time. Results go to `bench/results.json` | **Core** | Owner approved Oct 14. Runs Thu (P2 end / P3 start). N=10, or 5 if late |
| F24 | **Landing page:** hero + one-line pitch, the live/replay demo embed, **benchmark results** (from F23), "how it works" with the graph model, competitor comparison, links (repo, video, blog) | **Polish** | Owner approved Oct 14. Built in P3 with the UI playbook (§15) |

---

## 2. Architecture

```
 Cursor agent (Cursor app)           Claude Code agent            Orchestrator (Claude)
 ┌───────────────────────────┐     ┌─────────────────────┐      ┌───────────────────┐
 │ .cursor/mcp.json ──┐      │     │ .mcp.json ──┐       │      │ MCP + CLI         │
 │ .cursor/hooks.json │      │     │ .claude/settings    │      └────────┬──────────┘
 │  afterFileEdit     │      │     │  PreToolUse (deny)  │               │
 │  sessionStart      │      │     │  PostToolUse, Start │               │
 └──────┬─────────────┼──────┘     └──────┬──────┬───────┘               │
        │ hook → `switchboard` CLI        │      │ stdio MCP             │
        ▼                                 ▼      ▼                       ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  packages/core  (TypeScript): graph.ts (client, indexes), parser.ts (ts-morph)│
 │  queries/*.ts (every Cypher string lives here, named, documented)             │
 │  Surfaces: packages/mcp (stdio MCP, 10 tools)  ·  packages/cli (`switchboard`)│
 └──────────────────────────────┬───────────────────────────────────────────────┘
                                │ falkordb npm client (Redis protocol, :6379)
                                ▼
                     ┌──────────────────────┐   one graph per project: sb_<slug>
                     │   FalkorDB (Docker)  │   Event.seq is the message bus
                     └──────────┬───────────┘
                                │ poll Event.seq > last (500 ms) + read queries
                                ▼
 ┌──────────────────────────────────────────────┐    ┌──────────────────────────┐
 │ apps/server (Node/Hono): /api/*, /events SSE │───▶│ apps/web (Vite+React+    │
 │ serves built UI; replay runner; rate limit   │    │ Sigma.js canvas, panels) │
 └──────────────────────┬───────────────────────┘    └──────────────────────────┘
                        │ cloudflared tunnel (demo Mac)        judges' browser
                        ▼
                 https://switchboard.<owner>.xyz
```

**Data flow.** An agent calls `claim` (MCP) or its hook runs `switchboard check <file>` (CLI). Both go through `core` → Cypher on FalkorDB. Every write also `CREATE`s an Event node with a monotonically increasing `seq`. The web server polls `MATCH (e:Event) WHERE e.seq > $last` twice a second and pushes new events over SSE; the UI mutates its graphology graph in place (no re-layout storms). There is no message broker and no second database: **the graph is the bus**. Remove FalkorDB and nothing works, not even the event feed.

**Why no HTTP between MCP and FalkorDB?** One hop fewer, one process fewer per agent, and the agent's identity comes free from its cwd (branch name). The web server is the only long-running process besides FalkorDB.

### Tech stack

| Layer | Choice | One-line reason | Status |
|---|---|---|---|
| Language | TypeScript everywhere, Node 22, npm workspaces | One toolchain for Cursor workers; the parser needs TS anyway; `falkordb` requires Node ≥ 22 | VERIFIED (`npm view falkordb engines.node` = `>=22`) |
| Graph DB | FalkorDB `falkordb/falkordb:latest` in Docker (OrbStack) | Required; multi-graph; `algo.WCC`, `algo.pageRank`, `algo.SPpaths`, `algo.bfs`, full-text | VERIFIED docs |
| DB client | `falkordb` npm 6.8.0 (Aug 2026) | `FalkorDB.connect`, `selectGraph`, `query(cypher, {params})`, `db.list()`, built on node-redis | VERIFIED README |
| MCP server | `@modelcontextprotocol/server` (SDK v2, stable since 2026-07-27), stdio transport, zod v4 schemas | v1 (`@modelcontextprotocol/sdk` 1.32.1) is in maintenance; v2's `registerTool` + `StdioServerTransport` is 20 lines | VERIFIED README |
| Parser | `ts-morph` 28 (TypeScript compiler API) | Resolves relative/alias imports via tsconfig for free; `getImportDeclarations()` per file; `findReferences` for CALLS later. tree-sitter is faster and multi-language but syntax-only; one language this week | VERIFIED version; trade-off from sources |
| Web server | Hono on Node (`@hono/node-server`) | Tiny, typed, SSE helper; also hosts the built UI as static files | known |
| UI | Vite + React 18 + `sigma` 4.0.1 + `graphology` (+ `@react-sigma/core` 5) | WebGL, incremental add/remove without full re-layout, node/edge *reducers* make "light the path" one function; polished look achievable | VERIFIED versions |
| UI fallback | `@falkordb/canvas` 0.3.3 (web component, FalkorDB's own) | `setData()` replaces the whole graph (no incremental updates documented); keep only if Sigma blocks a worker | VERIFIED docs |
| Hooks | Claude Code hooks (JSON `permissionDecision: deny`), Cursor `.cursor/hooks.json` | See §2.1 | Claude: VERIFIED; Cursor over ACP: UNVERIFIED |
| Deploy | cloudflared tunnel on the spare Mac; `launchd` plists; Docker restart policy | Already decided in HACKATHON.md | |
| LLM | None on the critical path. Optional Haiku summaries (F20) behind a daily cap | Judges reward "LLM proposes, graph decides"; protects the $100 | |

### 2.1 Hooks: what is actually supported (researched today)

| Need | Claude Code | Cursor IDE | Cursor CLI / ACP (not used) |
|---|---|---|---|
| Block an edit before it happens | `PreToolUse` matcher `Edit\|Write`, exit 2 or JSON `permissionDecision:"deny"` + reason. **VERIFIED** | `preToolUse` matcher `Write`, `{"permission":"deny","agent_message":…}`. Docs list `Write` as a matcher value; "ask" is not enforced. **VERIFIED for IDE** | Forum (Apr–Jun 2026, staff): CLI fires `beforeShellExecution`, `afterShellExecution`, `afterFileEdit`, `postToolUse`, `stop`, `sessionStart`; cloud agents fire `preToolUse`. **`preToolUse` in local CLI/ACP: UNVERIFIED** |
| Log an edit after it happens | `PostToolUse` | `afterFileEdit` (`file_path`, `edits`) | `afterFileEdit` **works in CLI per staff (Apr 2026)**; ACP untested |
| Inject a briefing at start | `SessionStart` → `additionalContext` (10k chars cap) **VERIFIED** | `sessionStart` → `additional_context` | CLI: works per staff; ACP untested |
| Gate shell | `PreToolUse` Bash | `beforeShellExecution` allow/deny/ask | works in CLI |
| Config location | `.claude/settings.json` (project) | `.cursor/hooks.json` (project) or `~/.cursor/hooks.json` | same files |
| Failure mode | hook error → tool proceeds unless exit 2 | non-zero exit fails **open** unless `failClosed:true`; exit 2 blocks | same |

**Decision for the MVP.** Enforcement has three layers so the product works with any agent:
1. **The `claim` MCP tool is the contract.** Worker rules (`.cursor/rules`, `CLAUDE.md`) say: claim before editing; on CONFLICT, stop and pick another task or coordinate. This is advisory and vendor-neutral.
2. **Claude Code gets the hard block** (PreToolUse deny with the path in the reason). This is the deterministic "gate" the judges praised in past winners and is the demo's enforcement shot.
3. **Cursor gets logging + late-collision detection** (`afterFileEdit` → `switchboard edited <file>`; if that file is inside another agent's claim footprint, an `Event{kind:'collision'}` fires and the UI flashes it). If the Day-0 test shows `preToolUse` fires over ACP, enable the deny there too (F12 stretch).

MCP in Cursor over ACP: docs say ACP loads project/user `.cursor/mcp.json` (**VERIFIED docs**); a March 2026 bug where ACP ignored MCP was reported fixed in April (**UNVERIFIED** that it stays fixed). Headless `-p` needed `--force/--yolo` for MCP tools (forum). **Fallback if MCP does not reach Cursor workers:** the `switchboard` CLI does everything the MCP does (`switchboard claim a.ts b.ts --task T3`), and the worker rules tell the agent to run it from the shell. Same core, two surfaces, so this costs one small task.

---

## 3. Graph data model

One FalkorDB graph per project, keyed `sb_<slug>` (multi-graph tenancy; `GRAPH.QUERY sb_demo …`). Nothing is shared across graphs.

### Nodes

| Label | Properties | Notes |
|---|---|---|
| `File` | `path` (unique, repo-relative), `lang`, `loc`, `hash`, `hub:boolean`, `rank:float` | `hub` set by the PageRank job |
| `Symbol` | `fqn` (unique `path#name`), `name`, `kind` (fn/class/const/type), `line` | Polish (F16) |
| `Agent` | `id` (unique; default = branch name), `kind` (cursor/claude/human), `status` (active/idle/dead), `startedAt`, `lastSeen` | |
| `Task` | `id` (unique), `title`, `status` (open/active/done/blocked), `branch`, `createdAt` | |
| `Decision` | `id`, `text`, `why`, `at`, `status` (active/superseded) | Semantic memory |
| `Lesson` | `id`, `text`, `at` | Procedural memory |
| `Event` | `seq` (unique int, monotonic), `kind` (register/claim/conflict/release/edit/collision/decision/lesson/handoff/heartbeat), `at`, `payload` (JSON string) | Episodic memory; the bus |
| `Meta` | `key='seq'`, `value` | Single counter node for `Event.seq` (one write query = atomic) |

### Edges

| Edge | From → To | Properties | Source |
|---|---|---|---|
| `IMPORTS` | File → File | `specifiers` (list) | parser |
| `DEFINES` | File → Symbol | | parser (Polish) |
| `CALLS` | Symbol → Symbol | `count` | parser (Polish) |
| `CLAIMS` | Agent → File (or Symbol) | `since`, `until`, `taskId`, `intent` | `claim` tool |
| `WORKS_ON` | Agent → Task | `since` | `register_agent` / `claim` |
| `TOUCHES` | Task → File | planned footprint | orchestrator, `plan_task` |
| `INTERFERES` | Task ↔ Task | `via` (file path), `hops` | materialised by the scheduler query, then WCC |
| `EDITED` | Agent → File | `at`, `seq` | hooks |
| `MADE` | Agent → Decision | | |
| `AFFECTS` | Decision → File / Symbol | | |
| `SUPERSEDES` | Decision → Decision | `at` | |
| `ABOUT` | Lesson → File / Symbol | | |
| `BY` | Event → Agent | | every write |
| `ON` | Event → File / Task / Decision | | every write |
| `UNDER` | Event → Task | | edits and claims carry their task |
| `CAUSED_BY` | Task → Decision | | the why-trace link |
| `HANDED_OFF` | Agent → Agent | `taskId`, `note`, `at` | `handoff` tool |
| `BLOCKED_BY` | Task → Task | | Polish |

### Indexes (created by `ensureSchema()` on first connect, idempotent)

```
CREATE INDEX FOR (f:File) ON (f.path)
CREATE INDEX FOR (s:Symbol) ON (s.fqn)
CREATE INDEX FOR (a:Agent) ON (a.id)
CREATE INDEX FOR (t:Task) ON (t.id)
CREATE INDEX FOR (e:Event) ON (e.seq)
CREATE INDEX FOR (d:Decision) ON (d.id)
CREATE INDEX FOR ()-[c:CLAIMS]-() ON (c.until)
CALL db.idx.fulltext.createNodeIndex('Decision', 'text', 'why')
CALL db.idx.fulltext.createNodeIndex('Lesson', 'text')
```
(Range index syntax and `db.idx.fulltext.createNodeIndex/queryNodes` VERIFIED in docs. Note the known limitation: `<>` filters do not use indexes; LIMIT does not constrain MERGE/CREATE.)

### Memory types, mapped to the track text
Episodic = `Event` (+`BY`,`ON`,`UNDER`). Semantic = `Decision`/`SUPERSEDES`/`AFFECTS`. Procedural = `Lesson`/`ABOUT`. Shared state and handoffs = `CLAIMS`, `WORKS_ON`, `HANDED_OFF`. Per-tenant = one graph per project. High-concurrency = FalkorDB serialises writes per graph (FIFO) and runs reads in parallel; every Switchboard write is a single atomic query (VERIFIED concurrency page).

---

## 4. Key Cypher queries (specs)

All queries live in `packages/core/src/queries/*.ts`, each exported with a name, a doc comment and the exact string, so the README's "queries" section is generated from the source. Parameters use `$name` (FalkorDB caches plans per parameterised query). `K` (max hops) = 3 by default.

### Q1 Dependency conflict (the hero)

**Input:** `$agent`, `$paths` (list), `$now`, `$k`.
**Spec:** For each requested file `f`, find every *active* claim `(o:Agent)-[c:CLAIMS]->(g:File)` by another agent (`o.id <> $agent AND c.until > $now`) where either
- `g = f` (same file, hop 0), or
- `f -[:IMPORTS*1..k]-> g` (I depend on what they're changing; type `UPSTREAM`), or
- `g -[:IMPORTS*1..k]-> f` (they depend on what I'm about to change; type `DOWNSTREAM`),

skipping paths that pass through a `hub` file (except hop 0), and return the shortest such path per (f, o): `shortestPath((f)-[:IMPORTS*..k]-(g))`, `nodes(p)`, `length(p)`, `o.id`, `c.taskId`, `c.intent`. Empty result = no conflict = claim granted in the same tool call (second write query: `MERGE (a)-[:CLAIMS {since,until,taskId}]->(f)` + Event). 
**Why a graph:** the answer is a path of unknown length between two moving sets (my files, their claims). In SQL this is a recursive CTE per pair with no path object to show; here it is one pattern and the path is the evidence drawn on screen.
**Guard:** `shortestPath` requires both ends bound and no property filters inside the pattern (VERIFIED), so bind `f` and `g` first with `MATCH`, then compute the path; cap `k` at 4; `timeout` 2000 ms per query.

### Q2 Blast radius

**Input:** `$path`, `$k`.
**Spec:** `MATCH (f:File {path:$path}) OPTIONAL MATCH p=(d:File)-[:IMPORTS*1..k]->(f) WHERE NOT d.hub RETURN d.path, min(length(p)) AS hops ORDER BY hops, d.path`, plus a count per hop and the list of agents currently claiming any `d`. Zero rows = "no dependents, provably safe to change alone" (absence as evidence). Symbol variant (Polish): `(s2:Symbol)-[:CALLS*1..k]->(s:Symbol)`.
**Why a graph:** transitive closure with per-hop grouping and a displayable path.

### Q3 Parallel-safe tasks (WCC)

**Step 1 (materialise interference):** for every pair of open tasks `t1 <> t2`, they interfere if their footprints meet within `k` hops:
`MATCH (t1:Task {status:'open'})-[:TOUCHES]->(f1:File), (t2:Task {status:'open'})-[:TOUCHES]->(f2:File) WHERE id(t1) < id(t2) AND (f1 = f2 OR (f1)-[:IMPORTS*1..k]-(f2)) AND NOT f1.hub AND NOT f2.hub WITH t1, t2, f1.path AS via, … MERGE (t1)-[:INTERFERES {via, hops}]-(t2)`.
**Step 2 (components):** `CALL algo.WCC({nodeLabels:['Task'], relationshipTypes:['INTERFERES']}) YIELD node, componentId RETURN componentId, collect(node.id) AS batch`.
Each component is a group that must be serialised (or given to one agent); tasks from *different* components can run at the same time. `INTERFERES` edges are deleted and rebuilt on each call (cheap at task counts < 100).
**Why a graph:** connected components is the definition of "cannot affect each other"; `algo.WCC` is built in (VERIFIED: `nodeLabels`/`relationshipTypes` config, yields `node, componentId`). Nerveplane does this from hand-declared scopes; ours is derived from the parsed code.

### Q4 Briefing for a fresh or replacement agent

**Input:** `$area` (a task id, or a list of paths / a directory prefix), `$limit`.
**Spec:** resolve the area to a file set `F` (`Task-[:TOUCHES]->File` or `File.path STARTS WITH $prefix`); then in one query with `OPTIONAL MATCH`es collect, each with its hop distance from `F` (0 = direct, 1–2 via `IMPORTS`):
- active claims on or near `F` (who, until, task),
- decisions `(d:Decision {status:'active'})-[:AFFECTS]->(x)` where `x` within 2 hops of `F`,
- lessons `-[:ABOUT]->` within 2 hops,
- the last 20 `Event`s `-[:ON]->` files in `F` (by `seq` desc), including the dead agent's edits,
- open tasks touching `F`, and the latest `HANDED_OFF` note for the task.
Return ordered by hop distance then recency. Rendered as text for `additional_context` and as a highlighted subgraph in the UI.
**Why a graph:** one query, ranked by structural distance rather than string similarity; the briefing *is* a neighbourhood.

### Q5 Why-trace

**Input:** `$path` (a file), optional `$seq`.
**Spec:** `MATCH (f:File {path:$path})<-[:ON]-(e:Event {kind:'edit'})-[:BY]->(a:Agent), (e)-[:UNDER]->(t:Task) OPTIONAL MATCH (t)-[:CAUSED_BY]->(d:Decision)<-[:MADE]-(da:Agent) OPTIONAL MATCH (d)<-[:SUPERSEDES*0..3]-(latest:Decision) RETURN e, a, t, d, da, latest ORDER BY e.seq DESC LIMIT 5`, plus the path for the canvas: `shortestPath((f)-[:ON|BY|UNDER|CAUSED_BY|MADE|AFFECTS*..6]-(d))`.
Also a decision-first variant: `CALL db.idx.fulltext.queryNodes('Decision', $q) YIELD node` → `AFFECTS` files → agents who edited them after `d.at`.
**Why a graph:** provenance is a chain across five node types; the answer is the chain itself.

### Q6 Hubs (PageRank) and the "utils problem"

`CALL algo.pageRank('File', 'IMPORTS') YIELD node, score` → set `node.rank = score`, and `node.hub = true` for the top 3% by score (or in-degree > N, whichever is simpler to explain). Q1–Q4 skip multi-hop paths through hubs; hop-0 (same file) still warns. Re-run after every parse. (VERIFIED signature: `algo.pageRank(label, relationshipType) YIELD node, score`.)

### Q7 Edits and collisions (hooks)

`switchboard edited <file>`: `MATCH (a:Agent {id:$agent}), (f:File {path:$path}) MERGE (a)-[:EDITED {at:$now, seq:$seq}]->(f)` + Event. Then Q1 in reverse: if `f` sits in another active claim's footprint and `a` holds no claim on it, emit `Event{kind:'collision'}` (late detection for agents whose hooks can't block).

### Q8 Event feed (the bus)

`MATCH (e:Event) WHERE e.seq > $last OPTIONAL MATCH (e)-[:BY]->(a) OPTIONAL MATCH (e)-[:ON]->(x) RETURN e, a.id, labels(x)[0], coalesce(x.path, x.id) ORDER BY e.seq LIMIT 200` (read-only; `GRAPH.RO_QUERY`). Seq is allocated by `MATCH (m:Meta {key:'seq'}) SET m.value = m.value + 1 RETURN m.value` inside the same write query as the Event (atomic per query; writes to a graph are serialised FIFO, VERIFIED).

### Algorithms reference (VERIFIED signatures)

| Procedure | Signature | Used for |
|---|---|---|
| `algo.WCC` | `CALL algo.WCC({nodeLabels:[…], relationshipTypes:[…]}) YIELD node, componentId` | Q3 batches |
| `algo.pageRank` | `CALL algo.pageRank(label, relType) YIELD node, score` | Q6 hubs |
| `algo.bfs` | `CALL algo.bfs(startNode, maxDepth, relType) YIELD nodes, edges` | Q2 alternative; note it holds visited nodes in memory, keep depth ≤ 4 |
| `algo.SPpaths` | `CALL algo.SPpaths({sourceNode, targetNode, relTypes, maxLen, relDirection, pathCount}) YIELD path, pathWeight` | Q1 when we want *all* shortest conflict paths (`pathCount:0`) for the UI |
| `shortestPath()` / `allShortestPaths()` | Cypher functions (FalkorDB extension; both ends bound; no property filters in the pattern) | Q1, Q5 |
| `db.idx.fulltext.queryNodes` | `CALL db.idx.fulltext.queryNodes('Decision', $q) YIELD node, score` | Q5 decision-first |

---

## 5. Phases and time boxes (Pacific time)

Principle: **every tag is submittable.** Each phase ends with a tag, a one-line "what a judge would see", and a rollback point (the previous tag). Feature freeze: **Sat Oct 17, 12:00 PM**. Internal submission-ready: **Fri 11:00 PM**.

| Phase | Window | Goal | Exit criteria (demoable) | Tag | Rollback |
|---|---|---|---|---|---|
| **P0 Setup** | Tue 11:31 AM – 2:00 PM | Repo, toolchain, FalkorDB up, Cursor workflow proven, Day-0 hook/MCP tests | `npm test` green on an empty core; FalkorDB answers `RETURN 1`; one Cursor agent made a commit on a branch; hook/MCP test results recorded in DEVLOG | `v0.0-setup` | n/a |
| **P1 MVP** | Tue 2:00 PM – Wed 1:00 PM | Thinnest end-to-end slice | Parse demo repo → graph; agent A claims `auth/session.ts`; agent B `claim('ui/LoginForm.tsx')` → CONFLICT with a 3-hop path; canvas shows the path in red; event feed scrolls | `v0.1-mvp` | `v0.0` |
| **P2 Core** | Wed 1:00 PM – Thu 2:00 PM | Memory + hooks + algorithms | Decisions, lessons, briefing, why-trace, Claude Code deny hook, Cursor afterFileEdit logging, WCC batches, PageRank hubs, replay script of the demo scenario | `v0.2-core` | `v0.1` |
| **P3 Visual polish** | Thu 2:00 PM – Fri 10:00 AM | It has to look amazing | Dark premium theme, animated path highlight, agent presence panel, Cypher panel, replay controls, empty/error states, 60-second judge path | `v0.3-polish` | `v0.2` |
| **P4 Ship** | Fri 10:00 AM – Fri 11:00 PM | Freeze at noon; deploy, README, video, blog | Live URL up through the tunnel with static fallback; README with model + queries + AI disclosure; video recorded; blog drafted; submission form filled but not sent | `v1.0` | `v0.3` |
| **P5 Submit** | Sat 6:00 AM – 10:30 AM | Final cut, submit | Submitted with both tracks named; links checked from a phone on cellular | `v1.0.1` | `v1.0` |

Owner sleep: Tue ~1 AM, Wed ~1 AM, Thu ~1 AM, Fri ~1 AM. Nothing on the critical path is scheduled while asleep.

### P0 Setup (Tue 11:31 AM – 2:00 PM) — owner + 2 workers

Day-0 tests (results go into `docs/DEVLOG.md`; each changes a decision):
1. **Cursor hooks in the Cursor app:** add a `.cursor/hooks.json` with `afterFileEdit`, `sessionStart`, `preToolUse` (Write) and `beforeShellExecution`, each appending its event name to `/tmp/sb-hooks.log`; ask a Cursor Agent to edit a file and run `ls`. Which lines appear decides F12 (deny vs log-only).
2. **MCP over ACP:** `.cursor/mcp.json` with a stdio echo server (the MCP SDK's greet example); worker prompt "call the greet tool". If it cannot, workers use the CLI surface (same core).
3. **Claude Code hook:** `PreToolUse` deny on `Edit` of `BLOCKED.md` in a throwaway session — expect "Blocked".
4. **FalkorDB:** `docker run -p 6379:6379 -p 3000:3000 falkordb/falkordb:latest`; `GRAPH.QUERY t "CALL algo.WCC(null) YIELD node, componentId RETURN count(*)"` and `CALL algo.pageRank(null,null)`; record the server version.
5. **Second Cursor account:** confirm it signs in (a second window or profile) so heavy tasks can be split across the two accounts.

### P1 MVP (Tue 2:00 PM – Wed 1:00 PM)

Scope: F1–F6 only. Demo repo first (so the parser has a target), then core + MCP + server + UI in parallel lanes. End of Tuesday goal: Q1 returning a conflict path in a unit test against a live FalkorDB. Wednesday morning: the UI shows it.

### P2 Core (Wed 1:00 PM – Thu 2:00 PM)

Scope: F7–F15, F20 (AI summary, after F9), F21 (model), F23 benchmark harness + first run (Thu morning), replay script (F18 minimal: a Node script that calls the core, not the UI). Dogfooding switches on at the start of P2 (§11) in advisory mode.

### P3 Visual polish (Thu 2:00 PM – Fri 10:00 AM)

Dedicated. No new features except the F24 landing page (hero, demo embed, F23 benchmark results, how it works, competitor table). Design direction decided by the owner at the P2 checkpoint (§10) from three one-screen mockups a worker produces Thursday noon. Scope: theme tokens, typography, canvas styling (node size by `rank`, colour by label, claimed files with agent-coloured rings, conflict path pulse), side panels (agents, events, decisions), the Cypher drawer, replay transport (play/pause/step), responsive down to 1280 px, a `/judge` page (the 60-second path: three buttons that run Q1, Q3, Q5 on the seeded graph and show the query + result).

### P4 Ship (Fri 10:00 AM – 11:00 PM)

- 10:00–12:00 last fixes; **12:00 feature freeze** (`v0.3-polish` tagged; main is protected: only docs, deploy, and bug fixes with a failing test first).
- 12:00–3:00 deploy on the spare Mac: Docker compose (FalkorDB with `--restart unless-stopped`, volume), `launchd` plist for the server, cloudflared named tunnel → `switchboard.<domain>`, static fallback page served by Cloudflare if origin is down (a Worker or a Pages fallback), rate limit on `/api` (10 req/s per IP, no LLM endpoint exposed unless F20 ships with a cap).
- 3:00–6:00 README (setup, graph model with a diagram, every query from `queries/*.ts`, the WCC and PageRank sections, AI disclosure, "what the human did" section, ablation: "remove FalkorDB → these 8 things stop").
- 6:00–9:00 demo rehearsal ×3 against the replay script, record the best; the one live moment recorded separately.
- 9:00–11:00 blog draft (§8 has the outline), submission form filled.

### P5 Submit (Sat 6:00–10:30 AM)

Final cut (captions, 1080p), upload (YouTube unlisted + a copy in the repo release), check the live URL from a phone, submit by **10:30 AM** (59 minutes of buffer).

---

## 6. Task breakdown

Rules for every task: one branch `hack/<id>` (its own git worktree when running in parallel, §17.4), one brief in `docs/tasks/<id>.md` from `docs/tasks/_template.md`; touches only the listed paths; commits small; ends with a summary + `git diff --stat main` + test output. Tasks in this table are small and can be **bundled** into one Cursor task of 20–45 minutes (§17.5 gives the bundles). Merge one branch at a time and rerun `npm test`. Parallel groups share no files; lanes that touch `packages/core/src/queries/` get one file each.

Repo layout (fixed in P0 so tasks are file-disjoint):
```
packages/core/src/{graph.ts, schema.ts, parser.ts, events.ts, queries/{conflict,blast,schedule,brief,why,hubs,edits,feed}.ts, index.ts}
packages/mcp/src/{server.ts, tools/*.ts}       packages/cli/src/{index.ts, commands/*.ts}
packages/hooks/{claude/*.sh, cursor/*.sh, templates/*.json}
apps/server/src/{index.ts, routes/*.ts, sse.ts, replay.ts}   apps/web/src/{App.tsx, graph/*, panels/*, theme/*}
demo-repo/  (synthetic TS app)   scripts/{seed.ts, scenario.ts, parse.ts}   docs/
```

### P0 tasks (Tue 11:31 AM – 2:00 PM)

| ID | Task | Touches | Parallel group | Who |
|---|---|---|---|---|
| S1 | Monorepo scaffold: npm workspaces, TS 5 config, vitest, eslint, `packages/*` + `apps/*` empty with `index.ts`, root scripts (`dev`, `test`, `build`) | root, all package.json | A | Cursor |
| S2 | `docker-compose.yml` (FalkorDB 6379/3000, volume), `.env.example`, `.gitignore`, `scripts/wt.sh` (worktree helper, §17.4) | root files | A | Cursor |
| S3 | Hook probes: `.cursor/hooks.json`, `.claude/settings.json`, `probe.sh` logging event names; MCP echo server `scripts/mcp-echo.ts` | `.cursor/`, `.claude/`, `scripts/` | A | Cursor |
| S4 | Worker rules: `.cursor/rules/switchboard.mdc`, `CLAUDE.md`, `docs/tasks/_template.md`, `docs/DEVLOG.md` | docs, rules | A | Orchestrator |
| S5 | Run Day-0 tests 1–4 and record outcomes | DEVLOG | after A | Owner + orchestrator |

### P1 tasks (Tue 2:00 PM – Wed 1:00 PM)

| ID | Task | Touches | Group | Depends on |
|---|---|---|---|---|
| M1 | Demo repo: synthetic TS app, ~35 files, 4 dirs (`ui/`, `api/`, `auth/`, `lib/`), a planted chain `ui/LoginForm.tsx → api/login.ts → auth/session.ts → lib/crypto.ts`, and a real hub `lib/utils.ts` imported by 20 files; `tsconfig` with a path alias | `demo-repo/` | B | S1 |
| M2 | `core/graph.ts`: connect (env `FALKORDB_URL`, `SB_GRAPH`), `query/roQuery` wrappers with `timeout`, `ensureSchema()` (indexes above), `withEvent()` helper allocating `seq` | `core/graph.ts`, `core/schema.ts`, `core/events.ts` | B | S1 |
| M3 | `core/parser.ts`: ts-morph project from a root + tsconfig; emit `{files:[{path,loc,hash}], imports:[{from,to,specifiers}]}`; resolve relative and alias imports; skip `node_modules` and type-only imports flag | `core/parser.ts` + test fixture | B | S1 |
| M4 | `core/loader.ts`: idempotent `UNWIND $rows MERGE` for files and imports in batches of 500; deletes imports of re-parsed files | `core/loader.ts` | C | M2, M3 |
| M5 | `queries/conflict.ts` (Q1) + unit test against live FalkorDB using the M1 fixture | `queries/conflict.ts`, test | C | M2, M4 |
| M6 | `queries/feed.ts` (Q8), `queries/edits.ts` (Q7 write part only) | those files | C | M2 |
| M7 | MCP server skeleton: `register_agent`, `claim`, `release`, `heartbeat`, `status`; agent id from branch; stdio; `.mcp.json` + `.cursor/mcp.json` templates | `packages/mcp/`, templates | D | M5 |
| M8 | CLI: `switchboard parse <dir>`, `claim`, `release`, `check <file>` (exit 2 on conflict, prints path), `edited <file>` | `packages/cli/` | D | M5, M6 |
| M9 | Server: Hono app, `/api/graph` (nodes+edges snapshot), `/api/events` SSE (poll seq), `/api/claims`, serves `apps/web/dist` | `apps/server/` | D | M6 |
| M10 | Web: Vite+React+Sigma shell, load snapshot, apply SSE events to graphology, basic colours, path highlight reducer for `conflict` events | `apps/web/` | D | M9 contract (mock first) |
| M11 | `scripts/scenario.ts` step 1–2: register A/B, A claims session.ts, B claims LoginForm.tsx → conflict | `scripts/` | E | M7 |
| M12 | Tag `v0.1-mvp`; DEVLOG; screenshots | docs | E | all |

Group B runs 3 workers in parallel (M1, M2, M3); C after; D in parallel (M7–M10 touch disjoint packages; M10 starts against a written JSON contract in `docs/api.md`).

### P2 tasks (Wed 1:00 PM – Thu 2:00 PM)

| ID | Task | Touches | Group |
|---|---|---|---|
| C1 | `queries/brief.ts` (Q4) + test | queries/brief.ts | F |
| C2 | `queries/why.ts` (Q5) + test | queries/why.ts | F |
| C3 | `queries/blast.ts` (Q2) + test | queries/blast.ts | F |
| C4 | `queries/schedule.ts` (Q3: INTERFERES rebuild + WCC) + test with 5 tasks | queries/schedule.ts | F |
| C5 | `queries/hubs.ts` (Q6 PageRank, sets `hub`), run after load | queries/hubs.ts, loader hook | F |
| C6 | MCP tools: `record_decision`, `record_lesson`, `brief_me`, `why`, `blast_radius`, `plan_task`, `parallel_batches`, `handoff` | packages/mcp/tools/* (one file per tool) | G (after F) |
| C7 | CLI mirrors of C6 (`decide`, `lesson`, `brief`, `why`, `batches`) | packages/cli/commands/* | G |
| C8 | Claude Code hooks: `pre-edit.sh` (deny via JSON with path reason), `post-edit.sh` (edited), `session-start.sh` (brief → additionalContext); settings template | packages/hooks/claude | G |
| C9 | Cursor hooks: `after-edit.sh`, `session-start.sh`, optional `pre-write.sh`; hooks.json template; `failClosed:false` | packages/hooks/cursor | G |
| C10 | Server routes: `/api/brief`, `/api/why`, `/api/blast`, `/api/batches`, `/api/decisions`, `/api/replay/*` | apps/server/routes | G |
| C11 | Web panels: Agents (presence, claims), Events feed, Decisions list; click a file → blast radius highlight; `why` drawer with path | apps/web/panels | H (after C10 contract) |
| C12 | Web: batches view (components as colour groups) | apps/web/graph/batches.tsx | H |
| C13 | `scripts/scenario.ts` full: steps 1–5 of the demo (§8) with timing; `scripts/seed.ts` to reset the graph | scripts/ | H |
| C14 | Dogfood config: `.cursor/mcp.json`, `.mcp.json`, hooks pointing at `sb_switchboard`, `SWITCHBOARD_OFF` switch, worker rules updated | root config | H |
| C15 | Cursor `preToolUse` deny, only if Day-0 test 1 passed | packages/hooks/cursor | H (stretch) |
| C16 | Tag `v0.2-core`; DEVLOG; screenshots; owner checkpoint | docs | end |

### P3 tasks (Thu 2:00 PM – Fri 10:00 AM)

| ID | Task | Touches | Group |
|---|---|---|---|
| V0 | Three mockups (one screen each, HTML) for the owner to pick from, by Thu 1 PM | docs/mockups | before P3 |
| V1 | Theme tokens, fonts, dark palette, layout grid; app shell | apps/web/theme, App.tsx | I |
| V2 | Canvas styling: node size by rank, label colours, agent rings on claimed files, edge arrows, hover cards | apps/web/graph/style.ts | I |
| V3 | Path animation: conflict/why paths pulse and the camera eases to fit them | apps/web/graph/animate.ts | I |
| V4 | Agents panel redesign: avatars, status dots, current task, claim chips with TTL bars | apps/web/panels/Agents.tsx | J |
| V5 | Event feed redesign: grouped by agent, icons per kind, collision toast | apps/web/panels/Events.tsx | J |
| V6 | Cypher drawer: shows the named query and params behind the last answer, copy button | apps/web/panels/Cypher.tsx | J |
| V7 | Replay transport: play/pause/step/speed, scrubber, "live" badge | apps/web/panels/Replay.tsx | J |
| V8 | `/judge` page: three buttons (Conflict, Batches, Why) running on the seeded graph with query + result + path | apps/web/pages/Judge.tsx | K |
| V9 | Empty, loading, error states; 1280 px layout; favicon; title; OG image | apps/web misc | K |
| V10 | Screenshot pass and fixes (owner review) | — | end |

### P4/P5 tasks (Fri 10:00 AM → Sat)

| ID | Task | Touches |
|---|---|---|
| D1 | `deploy/`: compose file, launchd plist, cloudflared config, `deploy.md` runbook | deploy/ |
| D2 | Static fallback page + Cloudflare rule when origin down; rate limit middleware | apps/server, deploy/ |
| D3 | README: setup, model diagram (Mermaid), queries section generated from `queries/*.ts` (`scripts/gen-queries-doc.ts`), tracks, AI disclosure, human-direction section, ablation table | README.md, scripts |
| D4 | `docs/QUERIES.md` (generated) and `docs/DEMO.md` (the shot list) | docs |
| D5 | Blog post draft (dev.to), 900 words, 4 screenshots | docs/blog.md |
| D6 | Rehearse and record (owner); edit (owner + a worker for captions file) | video/ |
| D7 | Submission form; final checks from a phone | — |

---

## 7. Risk register

| Risk | Likelihood | Impact | Early warning | Mitigation | Fallback |
|---|---|---|---|---|---|
| Cursor hooks don't fire as documented | Med | Med | Day-0 test 1 shows only some events | Enforcement via the `claim` tool contract + `afterFileEdit` late-collision flag; Claude Code gets the hard block | Advisory mode for Cursor |
| MCP tools don't reach Cursor workers over ACP | Med | Med | Day-0 test 2 fails | CLI surface mirrors every tool | Workers use `npx switchboard …` from the shell; the demo's "MCP" agent is Claude Code |
| ts-morph alias/edge-case misses (re-exports, dynamic import, `index.ts` barrels) | Med | Med | Parser test on demo repo misses the planted chain | Demo repo uses plain relative + one alias; barrel files handled explicitly; unresolved imports dropped, never guessed | Hand-written `imports.json` for the demo repo loaded by M4 |
| "Everything is one component" (hub files) | High | High (Q3 useless, Q1 noisy) | WCC returns one batch | PageRank/in-degree hubs excluded from multi-hop paths; k ≤ 3 | Static hub list in `switchboard.json` |
| FalkorDB query cost on variable-length paths | Low (graph < 5k nodes) | Med | query > 500 ms | `timeout` 2000 ms, k capped at 4, indexes on `path`; `shortestPath` with bound ends | Drop to k = 2 |
| FalkorDB write serialisation under 4 agents + hooks | Low | Low | Event lag > 2 s | Each write is one query; hooks are fire-and-forget with 1 s timeout | Batch edits per second |
| Live multi-agent demo flakes | High | High | Rehearsal 1 fails | Scripted scenario drives 4 of 5 beats; only the "resume" beat is live, and it's recorded separately | Replay recording is the video; live site shows replay mode |
| Cloudflare Tunnel / spare Mac down during judging | Med | High | Uptime ping fails | launchd + Docker restart; `caffeinate`; static fallback at the edge | Local setup instructions + the recorded video |
| Worker merge conflicts | Med | Med | Two branches touch one file | File-disjoint briefs; one query file per task; `docs/api.md` contract before UI work | Orchestrator rebases and resolves; the later branch re-runs tests |
| A Cursor agent goes off-track on a long task | Med | Med | Edits outside its listed files; tests red | Briefs list exact files; review the diff before merge; split big tasks | Reset the branch, re-run with a tighter brief |
| Owner can't explain a query (rule 12) | Med | High (rejection) | Checkpoint quiz fails | §10 checkpoints; owner writes the README query section in their words | Simplify the query until the owner can draw it |
| Running out of time | High | High | A phase slips > 3 h | Cut lines below; tags are always submittable | Submit `v0.2-core` with the P3 theme only |
| graphmem or another entrant ships the same pitch | Med | Low | Discord/GitHub watch Thu | Lead with the parsed dependency path and WCC; show numbers | Position as "code-aware", theirs as "memory-only" |
| $100 API spend | Low | Low | F20 cap log | F20 off by default; cap $5/day; no public LLM endpoint | Remove F20 |
| Ambiguous `branch = agent id` when two agents share a branch | Low | Low | Duplicate agent | `SB_AGENT` env overrides | — |

### Cut lines (in order, if behind schedule)

1. F20 LLM summaries (never started unless everything else is done).
2. F16 symbol-level CALLS and symbol claims (stay file-level; the demo's 3-hop path is file-level anyway).
3. F12 Cursor `preToolUse` deny (keep afterFileEdit logging).
4. F15 PageRank hubs → static hub list in config (keep the PageRank query in the README as "used for hub detection", only if it actually ran once on the demo graph).
5. V7 replay transport (keep play-only), V8 judge page (fold into README).
6. F14 WCC UI (keep the query + a CLI `switchboard batches` output in the README).
7. F8 Lessons (fold into Decisions with `kind:'lesson'`).
8. F19 handoff/next_task.
9. Live deployment interactive → static replay only (still a URL).
10. Blog post (side prize only).

Never cut: parse → claim → conflict path → canvas; briefing; why-trace; README; video.

---

## 8. The demo (2-minute video, shot by shot)

Deterministic: `scripts/scenario.ts` replays beats 1–4 through the real MCP/core against a seeded graph (`scripts/seed.ts` resets `sb_demo`). Beat 5 is the one live moment (a real Claude Code session on the subscription). Screen: UI full-screen on the left 70%, a terminal strip on the right 30% showing agent output. Voice-over recorded separately; captions burned in.

| t | Shot | On screen | Voice-over |
|---|---|---|---|
| 0:00–0:10 | Title card → canvas fades in | The demo repo's graph: 35 files, import edges, hub `utils.ts` large in the centre | "Four AI coding agents on one repo. They forget, they collide, and nobody knows why code changed. Switchboard gives them one shared graph." |
| 0:10–0:25 | Beat 1: agents register | Agents A (Cursor) and B (Claude Code) appear in the panel; A claims `auth/session.ts` (ring + chip). Cypher drawer flashes the `MERGE … CLAIMS` | "The code is parsed into FalkorDB. Agent A claims the session module." |
| 0:25–0:50 | Beat 2: the conflict | B tries `ui/LoginForm.tsx`; the claim is refused; the 3-hop path LoginForm → login.ts → session.ts pulses red; terminal shows B's tool result "CONFLICT: A is changing auth/session.ts, which LoginForm.tsx depends on via api/login.ts"; drawer shows Q1 | "B wants the login form. A file lock would say it's free. The graph says no: three imports away, A is changing what it depends on. The path is the proof. B picks another task." |
| 0:50–1:05 | Beat 3: parallel batches | Orchestrator calls `parallel_batches`; the canvas groups 5 open tasks into 3 colour clusters; drawer shows `CALL algo.WCC` | "Which tasks can run at the same time? Connected components over the interference graph. Three batches, no hand-declared scopes." |
| 1:05–1:20 | Beat 4: a decision | A records "use argon2, not bcrypt; why: FIPS note"; the Decision node links to `lib/crypto.ts` and `auth/session.ts` | "Decisions live next to the code they affect." |
| 1:20–1:45 | **Beat 5 (live):** kill and resume | Terminal: A is killed mid-task (status → dead, claims expire). A fresh Claude Code session starts; its SessionStart hook prints the briefing (claims, the argon2 decision, A's last 6 edits, the open task). It continues the task and its first edit passes the PreToolUse check | "A dies. A new agent starts cold. Its briefing comes from the graph: what was claimed, what was decided, what was edited. It picks up where A stopped, and the hook lets the edit through because the path is clear." |
| 1:45–2:00 | Beat 6: why | Click `lib/crypto.ts` → "why?" → path lights: crypto.ts ← edit by A2 ← task T3 ← decision "argon2" ← made by A. Close on the README's query list | "Why does this code use argon2? The answer is a path. Switchboard: FalkorDB, MCP, hooks, open source. Link below." |

**Backup plan.** Record beats 1–4 and 6 from replay (three takes, keep the best). Record beat 5 live up to five times Friday evening; if none is clean, use replay for beat 5 too (the scenario script can emit the briefing text). The video is edited from clips, so a failed take costs minutes, not the demo. Export 1080p, ≤ 2:10, plus a 30-second cut for the blog.

---

## 9. Judge Q&A

1. **How is this different from Claude Code agent teams?** Agent teams share a task list and lock files by name inside one tool. Switchboard checks a claim against the parsed dependency graph (a 3-hop path, not a filename), works across Cursor and Claude Code, and keeps decisions and history so a replacement agent can be briefed. Their docs tell you to give teammates separate files; we tell you *which* files are separate.
2. **vs Foremerge?** Foremerge has advisory leases on declared scopes; its author lists a tree-sitter code graph as roadmap. Ours is built on the parsed graph today, and adds briefings, why-trace and WCC scheduling in the same store.
3. **vs MCP Agent Mail?** Mail is inboxes plus glob leases in SQLite; no code awareness, no dependency path. We don't do messaging; we do collision prediction and memory with evidence.
4. **vs wit?** wit is the closest on one check: "intent targets a caller of a locked symbol", advisory, SQLite, no memory, dormant since March. We generalise to k hops both ways, add components scheduling, decisions and briefings, and make the path visible.
5. **vs Nerveplane?** Nerveplane schedules batches by graph colouring over *hand-declared* YAML scopes and keeps a decision ledger in SQLite. Our interference graph is derived from parsed imports, so a transitive caller nobody declared is still caught; and the same graph answers why and briefs.
6. **vs graphmem (same hackathon)?** graphmem is memory and trace (facts, decisions, tasks) on FalkorDB with no claims and no code parsing. We have the memory half and the code half in one graph, and the conflict path is the hero.
7. **vs Graphiti?** A temporal-fact library (FalkorDB is a backend). We could store episodes in it, but our edges are structural (IMPORTS, CLAIMS, CAUSED_BY), not extracted text; no LLM is needed to build the graph.
8. **vs git worktrees?** Worktrees isolate edits; they do not prevent semantic conflicts and only tell you at merge time. We warn *before* the edit, and the warning carries the dependency path.
9. **Why a graph and not SQL?** Three queries are paths of unknown length between moving sets: conflict (my files ↔ their claims via imports), blast radius, why-trace. SQL needs recursive CTEs per pair and still has no path object to show; FalkorDB returns the path, and `algo.WCC` and `algo.pageRank` are one line. Remove FalkorDB and the event feed, claims, briefings and scheduling all stop (ablation table in the README).
10. **What if an agent ignores the claim?** Claude Code can't: the PreToolUse hook denies the edit with the path as the reason. Cursor logs every edit via `afterFileEdit`, and an unclaimed edit inside another agent's footprint raises a collision event (late, but visible). For agents with no hooks, the claim tool is the contract, and the graph still records who collided.
11. **Doesn't every file import utils, so it warns all the time?** Yes, which is why hubs are a first-class concept: PageRank on IMPORTS marks the top few percent as hubs, and multi-hop paths through a hub don't count (same-file still does). In the demo, `lib/utils.ts` is imported by 20 files and never causes a warning.
12. **What did you build vs the AI?** AI coding agents wrote most of the TypeScript, the Cypher and the README: Cursor (Opus 5.5 and Grok 4.7) and Claude Code, from task briefs that the main Opus 5.5 chat wrote and reviewed. The owner made the product decisions in §0.6, ran the Day-0 editor tests and directed the UI rebuild; the README's query section is generated from the source files by `npm run readme`, not written by hand. Disclosed in the README.
13. **How does it scale?** The graph is files and symbols (thousands, not millions); queries are bounded (k ≤ 4, timeouts, hub exclusion). FalkorDB runs reads in parallel and serialises writes per graph, and each of our writes is one atomic query. Parsing is incremental per file hash. Multi-project is one graph per project.
14. **Who would use this?** Anyone running 2–6 coding agents on one repo today: the owner does, with several Cursor agents and a Claude orchestrator. We did not use Switchboard to coordinate its own build, beyond one parse of our own repo.
15. **What happens when the claim TTL expires mid-edit?** Heartbeats extend it; the briefing shows stale claims; an expired claim's files show as "recently edited by X" for an hour so a late collision is still flagged.
16. **False positives?** Both directions can over-warn in a tightly coupled codebase. Hubs, k, and `intent` (read-only claims don't conflict) tune it. A warning is advisory for everyone but Claude Code's hook, and the hook's reason tells the agent exactly what to coordinate on.
17. **Why file-level, not symbol-level?** Symbol-level is in the model (Symbol, DEFINES, CALLS) and in the Polish tier; file-level was enough for the demo path and is what the parser gets right reliably in four days.
18. **Why TypeScript only?** One parser done well; the model is language-agnostic (File/IMPORTS); tree-sitter grammars are the obvious second step.
19. **Where does the LLM sit?** Nowhere in the decision path. The agents are LLMs; Switchboard is the deterministic referee. Optional prose summaries of a briefing are the only API call, capped.
20. **Is "no conflict" trustworthy?** It means no import path ≤ k hops between the sets, excluding hubs. We show that definition in the UI. It's the same "absence as evidence" the Hopper triage project was praised for; it's bounded, and the bound is on screen.

---

## 10. Owner learning checkpoints (rule 12)

| When | 15-minute checkpoint | Owner produces |
|---|---|---|
| P0 end | Draw the graph model from memory on paper; name the 8 edge types that matter | Photo in `docs/decisions/` |
| P1 mid (Tue ~8 PM) | Read `queries/conflict.ts`; run it in FalkorDB Browser (`:3000`) against the demo graph; change `k` and see the path change | A paragraph in DEVLOG explaining UPSTREAM vs DOWNSTREAM |
| P1 end | Explain why `shortestPath` needs bound ends and why hubs exist | Q&A answers 9 and 11 in the owner's words |
| P2 mid (Wed ~8 PM) | Run `CALL algo.WCC` and `algo.pageRank` by hand; read the INTERFERES rebuild | DEVLOG: "what WCC gives us that a loop would not" |
| P2 end | Walk the why-trace path by hand in the Browser | README "Queries" section draft, hand-written |
| P3 start | Pick the mockup; state the three visual priorities | docs/decisions/ui.md |
| P4 | Record the voice-over unscripted first, then with the script | video |
| Sat | Mock judge Q&A, 10 questions, timed | — |

---

## 11. Submission checklist and dogfooding

**Checklist (from HACKATHON.md):** public repo · README with setup + graph model · the Cypher queries/algorithms (generated `docs/QUERIES.md` + README section) · demo video (YouTube unlisted + release asset) · live URL (tunnel) with local instructions as backup · tracks named (Agent Memory and Coordination; Agents That Act on Connected Data) · AI disclosure and "human direction" section · blog post link · node/edge counts of the demo graph and the dogfood graph in the README.

**Dogfooding plan (from P2 start, Wed 1 PM).**
- Graph `sb_switchboard` on the dev Mac's FalkorDB. `scripts/parse.ts` runs on `main` after every merge (orchestrator step).
- Every worker brief from C1 onward adds: "Before editing, run `npx switchboard claim <files> --task <id>` (or the MCP `claim` tool). If CONFLICT, stop and report." Workers are file-disjoint by design, so a conflict is rare and real (an import path between two lanes).
- Hooks in the repo (`.cursor/hooks.json`, `.claude/settings.json`) log edits to `sb_switchboard`; the orchestrator records decisions (`switchboard decide …`) at each merge.
- **Safety:** advisory only for our build (no deny hooks on our own repo until Thursday); `SWITCHBOARD_OFF=1` in a worker's env disables hooks and the rules paragraph; hooks time out at 1 s and fail open; if FalkorDB is down, the CLI prints a warning and exits 0.
- **Payoff:** real history for the README ("during the build, N claims, M conflicts caught, K decisions"), a screenshot of the real graph, and an honest answer to Q14.

---

## 12. Open questions for the owner

1. Demo host domain: the exact `.xyz` subdomain, and is cloudflared already installed on the spare Mac?
2. Second Cursor account: already set up (owner, Oct 14).
3. Agent identity: branch name by default (proposed) or always explicit `SB_AGENT`?
4. Should Claude Code's deny hook be on for our own repo from Thursday (true dogfooding) or stay advisory until the demo?
5. Visual direction: pick from three mockups Thursday noon, or decide now (dark, graph-first, one accent colour is the proposal)?
6. Keep F20 (Haiku summaries) in at all, or ship with zero LLM in the product? (Proposal: zero; say so proudly.)
7. Blog platform (dev.to proposed) and whether to publish before or after submission.
8. Video: owner's voice, or captions only?
9. Name check: "Switchboard" is generic; keep, or add a qualifier for search (e.g. "Switchboard for agents")?

---

---

## 14. Workflows, step by step


### 14.0 / 14.1 The build loop
The build loop is the Cursor workflow in **§17** (no Paseo). Short version: write the brief → a Cursor agent does it on its own branch or worktree → review the diff and run the tests → merge into main → update STATUS, DEVLOG and BLOG-LOG.

### 14.2 Daily rhythm (Pacific time)
| Time | What |
|---|---|
| Start of day | Orchestrator reads DEVLOG + `git log`, re-plans the day against §5, writes the first 3–4 briefs |
| Every ~30–45 min | Merge finished workers, launch the next ones; keep 2–4 running |
| Lunch / dinner | A checkpoint: is the phase on time? If not, apply the next cut line (§7) |
| Before sleep | Everything merged or parked on a branch; `main` green; DEVLOG updated; tomorrow's first briefs written |

### 14.3 Rules that keep it simple
- **One source of truth:** `main` plus `docs/`. No work lives only in a chat.
- **Small and file-disjoint:** two parallel tasks never touch the same file. Shared files (`index.ts` exports, package.json) are edited only by the orchestrator or one dedicated task.
- **Tests first for queries:** every Cypher query has a test against a real FalkorDB with the planted demo repo (§4, testing layers in §12 item 9).
- **Never in too deep:** if a feature isn't working within its time box, stop, cut or simplify it (§7), and go back to the last tag.
- **The owner learns as it goes:** at every checkpoint the owner reads the five main queries in plain English and can explain them (rule 12).

### 14.4 Testing that it works (for us and for the judges)
1. **Query tests** against planted traps in the demo repo: a known 3-hop conflict, an unrelated file showing "no path", a hub file causing no false alarm, the expected WCC batches.
2. **Scripted replay:** a deterministic scenario drives the real tools. It is used for the video and as the live site's fallback.
3. **Real-agent run:** 2–3 real agents with overlapping tasks, plus dogfooding on our own build from Wednesday.
4. **(If approved) the with/without benchmark:** the same task 10× without and 10× with Switchboard, counting broken builds, test failures and overwritten work.
5. **`/judge` page:** three buttons (conflict, safe-parallel, why) that show the Cypher and the result.

### 14.5 Deploy and submit (Fri–Sat)
1. **Thursday evening:** the owner buys the .xyz subdomain and adds it to Cloudflare.
2. **Friday 12–3 PM:** on the spare Mac, install OrbStack + cloudflared, `docker compose up -d` (FalkorDB with `restart: unless-stopped`), the server under `launchd`, then `cloudflared tunnel create switchboard` → route `switchboard.<domain>`. Add the static replay fallback.
3. **Friday afternoon:** README (setup, graph model diagram, every query, algorithms, AI disclosure, "what the human did", competitors table).
4. **Friday evening:** record the video (the owner's voice, the §8 script, the best of 3 takes) and draft the blog.
5. **Saturday by 10:30 AM PT:**
   1. Make the repo public.
   2. Check every link from a phone on cellular.
   3. Fill in the form (Aside can read the form fields at the start).
   4. Name both tracks and submit.
   5. Then publish the blog.

---

## 15. UI playbook: how SolveLab got its look, and how we repeat it

SolveLab (the owner's other project) looks good because of a deliberate process, not a single skill. From `~/Projects/solvelab/docs/DESIGN.md`:
- **A reference look first:** the owner pointed at sites they loved (TAGDA Timer, csTimer), and the UI was rebuilt towards that "immersive, not neutral" feel.
- **Drafts and critique:** several full UI drafts in a separate folder (`~/Projects/solvelab-ui-drafts`, v6 "Studio", then v7 refined through council rounds) before touching the real app.
- **Components from 21st.dev, sourced from their authors' open registries:**
  - Aceternity **Glowing Effect** (glowing card borders)
  - Magic UI **Border Beam**, **Magic Card**, **Confetti**
  - **Tubelight Navbar** (sliding nav indicator, rebuilt with `motion`)
  - **NumberFlow** (rolling numbers)
  - **@paper-design/shaders** (animated WebGL swirl background)
  - **shadcn/ui** as the base, **Lucide** icons
- **A real design system:**
  - theme tokens only (no hard-coded colours)
  - a display serif for titles + a clean grotesk for UI + a tabular figures face
  - outline "tiles" over an animated background, glass only for floating chrome
  - motion that responds to input
  - accessibility (focus rings, reduced motion)
- **Skills and tools available here** for the same result: `design-taste-frontend` (anti-template design direction), `frontend` (UI implementation), `web-design-guidelines` (UI review against guidelines), `frontend-design` (used for the Glance UI), the **shadcn** and **magicui** MCP servers (component registries), and `dataviz` (for any charts).

**For Switchboard (phase P3):**
1. The owner picks a direction from 3 one-screen mockups (dark, graph-first, one accent colour is the default proposal).
2. Build the canvas with Sigma.js plus our own theme tokens.
3. Use Magic UI / Aceternity accents sparingly: border beam on a live conflict, glowing edges on the active path.
4. NumberFlow for live counters.
5. Run `web-design-guidelines` as a review pass before freeze.


---

## 17. Cursor execution manual: pick up exactly where planning stopped

This section is written **for the Cursor agent** (and the owner) who now runs the project. Nothing here needs the earlier Claude chat. If you are a Cursor agent starting fresh, do §17.1 first.

### 17.1 Where we are right now (handoff state, 2026-10-14)
- **Planning is finished.** The idea is locked (Switchboard), the plan is approved, and the decisions are in §0.6.
- **No product code exists yet.** The repo has `docs/`, `AGENTS.md` and `.cursor/rules/`. The hackathon has been open since **Wed Oct 14, 11:31 AM PT**, so coding is allowed now. **Day 1 was spent planning, so follow the CORRECTED SCHEDULE at the top of this file.**
- **The dev Mac is ready:**
  - OrbStack/Docker: the CLI is at `~/.orbstack/bin/docker` (add it to PATH if `docker` isn't found).
  - FalkorDB image `falkordb/falkordb:latest` is pulled. A container named `falkordb-learn` may be running on 6379/3000 as a learning playground; stop it before P0 (`docker rm -f falkordb-learn`).
  - `cloudflared` is installed.
  - Composio CLI is installed (not needed for the build).
- **The next action is P0** (§5, §6): bundle **B0** below.
- **Approved but not yet built:**
  - F20, the AI briefing summary (Core).
  - F23, the with/without benchmark (Core).
  - F24, the landing page showing the benchmark (Polish).
- **Not used:** Paseo, the Cursor CLI and ACP. Everything runs in the **Cursor desktop app**.

### 17.2 Read order for a fresh agent (about 20 minutes)
1. **This section, §17.**
2. **§0:** context, rules, decisions, glossary.
3. **§1–§4:** the product, architecture, graph model and queries.
4. **`docs/STATUS.md`:** what's done and what's next.
5. **The latest entries in `docs/DEVLOG.md`.**
6. **The brief of your task** in `docs/tasks/<id>.md`.

### 17.3 Model policy (owner decision, Oct 14)
| Role | Model in Cursor | Use for |
|---|---|---|
| **Main chat / orchestrator** | **Claude Opus 5.5** | Planning the day, writing briefs, reviewing diffs, merging, debugging, checkpoints, goal checks |
| **Subagents and smaller tasks** | **Grok 4.7** | Well-specified tasks from §6: one query file, one MCP tool, one panel, tests, docs, scripts, mechanical edits |
| **Big tasks** | **Claude Opus 5.5** | Parser and loader, the conflict query (Q1), hooks, the scheduler (WCC), the benchmark harness, the visual polish phase, anything that failed twice with Grok |

**Rule of thumb:** start a task on Grok 4.7 when the brief fully specifies the files and the acceptance tests. Use Opus 5.5 when the task needs design judgement or touches more than 3 files. If Grok's first attempt fails the tests twice, reset the branch and redo it with Opus.

**Subagents:** if your Cursor version supports custom subagents (`.cursor/agents/*.md` with a `model` field), define one called `worker` with model Grok 4.7 and the worker rules from §17.6. Otherwise open a **new Agent tab** and pick Grok 4.7 manually. Either way, each subagent gets exactly one brief.

### 17.4 Worktree workflow (parallel tasks without collisions)
- **One task means one branch:** `hack/<id>`. Never two agents in the same folder.
- **Sequential task (the simplest case)**, in the main folder `~/Projects/graph-hacks`:
  ```
  git checkout main && git pull && git checkout -b hack/<id>
  ```
- **Parallel task:** create its own worktree and open it in its own Cursor window:
  ```
  git worktree add ../gh-<id> -b hack/<id> main
  ```
  In each worktree, run `npm install` once (after S1 exists), and copy `.env` from the main folder.
- **Ports:** FalkorDB is shared (one container, 6379). Each worktree uses its **own graph name** (`SB_GRAPH=sb_<id>`) so tests don't collide. Dev servers use different ports: web `5173 + n`, server `8787 + n`.
- **At most 3 parallel tasks.** If the first Cursor account hits its limits, run the extra window on the second account.
- **After merge:**
  ```
  git worktree remove ../gh-<id> && git branch -d hack/<id>
  ```
- **Helper:** S2 creates `scripts/wt.sh new <id>` and `scripts/wt.sh rm <id>` wrapping the commands above.

### 17.5 Task bundles (the order to execute)
§6 has the small tasks. In Cursor, run them as these bundles. The model is in brackets; ∥ means the bundles can run in parallel worktrees.

| Bundle | Contains (§6 IDs) | Model | Runs after | Exit check |
|---|---|---|---|---|
| **B0 Setup** | S1, S2, S4 (rules files already exist; just verify) | Grok 4.7 | the start (11:31 AM Tue) | `npm test` green on an empty core, `docker compose up -d`, FalkorDB `RETURN 1` |
| **B1 Day-0 tests** | S3, S5 | Opus 5.5 | B0 | DEVLOG records which Cursor hooks fire and whether MCP tools are callable from Cursor and Claude Code |
| **B2 Demo repo** ∥ | M1 | Grok 4.7 | B0 | ~35 files, planted 3-hop chain, hub `lib/utils.ts`, `tsc` passes |
| **B3 Core graph** ∥ | M2 + M6 | Grok 4.7 | B0 | connect, schema, events, feed and edits tests green |
| **B4 Parser + loader** | M3 + M4 | **Opus 5.5** | B2, B3 | parsing demo-repo gives the expected file and import counts; re-parse is idempotent |
| **B5 Conflict query** | M5 | **Opus 5.5** | B4 | test: A claims session.ts, B claims LoginForm.tsx → CONFLICT with the 3-hop path; an unrelated file → OK |
| **B6 MCP + CLI** ∥ | M7 + M8 | Grok 4.7 | B5 | MCP `claim` callable from Cursor; `switchboard check` exits 2 on conflict |
| **B7 Server + web shell** ∥ | M9 + M10 | Opus 5.5 | B5 | canvas shows the graph, conflict path in red via SSE |
| **B8 MVP tag** | M11, M12 | Opus 5.5 (main chat) | B6, B7 | scenario steps 1–2 run end to end → tag `v0.1-mvp` + **goal check** |
| **B9 Queries** ∥ | C1–C5 (one file each; can be 2 worktrees) | Grok 4.7 (C4 schedule on Opus) | B8 | each query's test green against the demo repo |
| **B10 Tools + CLI** ∥ | C6 + C7 | Grok 4.7 | B9 | every tool callable, CLI mirrors work |
| **B11 Hooks** ∥ | C8 + C9 (+ C15 if Day-0 allows) | **Opus 5.5** | B9 | Claude Code deny works on a conflicting edit; Cursor afterFileEdit logs edits |
| **B12 AI summary** | F20: `core/summarize.ts` using the Anthropic SDK with Haiku, capped (max tokens, per-day budget, cache by briefing hash), env `ANTHROPIC_API_KEY`, off if unset | Grok 4.7 | B9 (C1) | the briefing returns `summary` + graph evidence; with no key it degrades to no summary |
| **B13 Server routes + panels** | C10, C11, C12 | Opus 5.5 | B10 | panels show agents, events, decisions; why drawer; batches |
| **B14 Scenario + dogfood** | C13, C14 | Opus 5.5 | B11, B13 | full demo scenario replays; our own Cursor agents use Switchboard (advisory) |
| **B15 Benchmark** | F23: `bench/` harness that runs the same multi-agent task N× without and N× with Switchboard on demo-repo, counting broken builds (`tsc`), failing tests, overwritten edits and time → `bench/results.json` + `bench/REPORT.md` | **Opus 5.5** | B14 | N=10 each (5 if late); numbers reproducible from the script |
| **B16 Core tag** | C16 | Opus 5.5 (main chat) | B12–B15 | tag `v0.2-core` + **goal check** |
| **B17 Mockups** | V0 | Opus 5.5 | before P3 | 3 one-screen HTML mockups; the owner picks one |
| **B18 Visual polish** | V1–V7 (2–3 worktrees by panel) | **Opus 5.5** | B17 | §15 UI playbook applied; screenshots reviewed by the owner |
| **B19 Landing + judge page** | F24 landing page (hero, demo embed, benchmark results from `bench/results.json`, how it works, competitor table, links) + V8 `/judge` + V9 | Opus 5.5 | B18, B15 | landing page live locally; numbers come from the file, not hard-coded |
| **B20 Polish tag** | V10 | Opus 5.5 (main chat) | B19 | tag `v0.3-polish` + **goal check**; **feature freeze Fri 12:00 PM** |
| **B21 Deploy** | D1, D2 | Opus 5.5 | freeze | live at `switchboard.<domain>` with the static fallback |
| **B22 Docs** | D3, D4 | Grok 4.7 | freeze | README complete (setup, model, queries, algorithms, AI disclosure, human-direction section, competitors, benchmark) |
| **B23 Blog** | D5, using `docs/BLOG-LOG.md` | Opus 5.5 | B22 | the blog draft in `docs/blog.md` |
| **B24 Video + submit** | D6, D7 | owner + main chat | all | tag `v1.0`; submitted by **Sat 10:30 AM PT** |

### 17.6 Rules every Cursor agent follows (also in `AGENTS.md` and `.cursor/rules/switchboard.mdc`)
1. **Only touch the files your brief lists.** If you need another file, stop and say so.
2. **Work on your branch only** (`hack/<id>`); never commit to `main` directly. Small commits with clear messages.
3. **No secrets in the repo.** `.env` is git-ignored, and `.env.example` holds placeholders only.
4. **FalkorDB is the only data store.** Don't add another database, because the graph must do the real work.
5. **Every Cypher query lives in `packages/core/src/queries/*.ts`** as a named export, with a test against a real FalkorDB (the demo repo fixture).
6. **No new dependency** without stating why in your final message.
7. **Finish with:** a summary, `git diff --stat main`, the test output, and a short note for DEVLOG and, if interesting, for BLOG-LOG.
8. **Hackathon rules:** public, synthetic or own data only. The owner must be able to explain what you built, so keep the code simple and commented where the logic is non-obvious.

### 17.7 Review and merge gate (main chat, Opus 5.5)
1. Run `git diff main...hack/<id>`: only the allowed files changed, no secrets, no stray dependencies.
2. Run `npm test` and `npm run typecheck` **yourself**, on the branch.
3. Merge (`git checkout main && git merge --no-ff hack/<id>`), rerun the tests on main, and push.
4. Update `docs/STATUS.md`: mark the task done, with the merge commit.
5. Add a dated entry to `docs/DEVLOG.md`: what changed, decisions, problems and fixes.
6. If anything was worth telling the world, add a line to `docs/BLOG-LOG.md` (§17.9).

### 17.8 Goal alignment: always build towards the goal, and check it at every checkpoint
**The goal (memorise it):** *Win the Agent Memory and Coordination track (second entry: Agents That Act on Connected Data) with a product where FalkorDB visibly does the real work. That means agents' edit claims are checked against a parsed code dependency graph; decisions, lessons and history live in the same graph; it warns before collisions, schedules safe parallel work and briefs replacement agents. It must have a polished UI, a landing page with real benchmark numbers, and a demo that can't fail. The owner must be able to explain every part.*

**Before starting any task,** ask: does this move us towards that goal, inside the current phase? If not, don't do it, or log it as a later idea in STATUS.

**At every checkpoint** (end of each bundle tag: B8, B16, B20, and each evening), the main chat runs this check and writes the answers into DEVLOG:
1. **Graph is essential:** if FalkorDB were removed, would the headline features stop working? (They must.)
2. **Track fit:** does what we have demonstrate memory (episodic, semantic, procedural), coordination (claims, conflicts, handoff) and per-project tenancy?
3. **Differentiation:** can we still say the positioning line (§0.5) truthfully? Have any competitor features or claims changed?
4. **The demo:** does the current §8 script run end to end on the current build? What's missing?
5. **Proof:** are the tests, the scenario replay and (after B15) the benchmark numbers real and reproducible?
6. **Explainability:** can the owner explain the newest query or feature in two sentences? If not, explain it to the owner now (§10).
7. **Schedule:** are we on time against §5? If not, apply the next cut line (§7) now; don't hope to catch up.
8. **Drift:** did we build anything not in the plan? Keep it only if it serves the goal.

If any answer is "no", fix that before starting the next bundle.

### 17.9 Logging as we go (DEVLOG + BLOG-LOG)
- **`docs/DEVLOG.md`, the engineering log.** One dated entry per merge or decision: what changed, why, problems, fixes, test results. It's the source for the README's "what the human did" section (rule 12) and the AI-disclosure section.
- **`docs/BLOG-LOG.md`, raw material for the blog post** (AirPods prize). Add an entry whenever something blog-worthy happens:
  - a design decision and why
  - a surprising bug
  - a "the graph caught it" moment
  - a screenshot worth sharing (save it to `docs/blog-assets/`)
  - benchmark numbers
  - a lesson about coordinating AI agents

  Format: `## <date time> — <title>` + 2–5 lines + the asset path. On Friday, B23 turns this log into the post.
- **`docs/STATUS.md`, the live tracker** of every bundle and task with its state (todo, doing, done, cut), branch, model, and notes. Update it at every merge.

### 17.10 The brief template (`docs/tasks/_template.md`)
Every task brief has:
- **Goal:** one sentence.
- **Context:** which PLAN sections and files to read.
- **Files you may touch / must not touch.**
- **Steps.**
- **Acceptance criteria:** runnable checks.
- **Model:** Grok 4.7 or Opus 5.5.
- **Branch:** `hack/<id>` (worktree yes or no).
- **Report format:** as in §17.6 item 7.

The main chat writes the brief, commits it to main, then starts the task.

### 17.11 When things go wrong
- **The agent is stuck or looping:** stop it. Commit what's useful, write a "what was tried" note into the brief, reset the branch and restart with a tighter brief (or switch Grok → Opus).
- **Tests red on main after a merge:** revert the merge commit immediately (`git revert -m 1 <sha>`). Fix it on a branch, never on main.
- **Behind schedule:** apply the cut lines in §7, in order. Never skip the goal check.
- **Something is broken at the end of a phase:** go back to the last tag; it's always submittable.


---

## 18. Sources

- Cursor hooks reference (events, matchers `Shell|Read|Write`, `permission` allow/deny, `failClosed`, exit 2): https://cursor.com/docs/agent/hooks and https://cursor.com/docs/hooks
- Cursor CLI hook gaps (staff replies Jan–Jun 2026): https://forum.cursor.com/t/cursor-cli-doesnt-send-all-events-defined-in-hooks/148316 ; https://forum.cursor.com/t/cursor-cli-omits-beforesubmitprompt-afteragentresponse-and-stop-hooks-loses-token-usage-and-emits-inconsistent-generation-id-values/169059
- Cursor ACP (MCP from `.cursor/mcp.json`, permissions, no mention of hooks): https://cursor.com/docs/cli/acp ; MCP-in-ACP bug and fix thread: https://forum.cursor.com/t/acp-agent-silently-ignores-mcpservers-in-session-new/153623 ; headless MCP injection (`--force`): https://forum.cursor.com/t/cursor-agent-p-mode-does-not-inject-mcp-server-tools-into-agent-context/155275
- Cursor CLI MCP: https://cursor.com/docs/cli/mcp ; local CLI `agent --help` (2026.10.01) shows `--force`, `--approve-mcps`, `acp`
- Claude Code hooks (PreToolUse `permissionDecision`, exit 2, SessionStart `additionalContext`, matchers): https://code.claude.com/docs/en/hooks
- MCP TypeScript SDK v2 (`@modelcontextprotocol/server`, `registerTool`, stdio): https://github.com/modelcontextprotocol/typescript-sdk ; v1 `@modelcontextprotocol/sdk` 1.32.1 on npm
- FalkorDB Node client (`FalkorDB.connect`, `selectGraph`, `query` with params, Node ≥ 22): https://github.com/FalkorDB/falkordb-ts ; npm `falkordb` 6.8.0
- FalkorDB algorithms: https://docs.falkordb.com/algorithms/ (WCC, BFS, SPpaths, PageRank pages: /algorithms/wcc, /algorithms/bfs, /algorithms/sppath, /algorithms/pagerank)
- FalkorDB Cypher functions (`shortestPath`, `allShortestPaths`, `nodes`, `relationships`, `toJSON`, `reduce`): https://docs.falkordb.com/cypher/functions ; known limitations: https://docs.falkordb.com/cypher/known-limitations ; indexes: https://docs.falkordb.com/cypher/indexing/range-index , https://docs.falkordb.com/cypher/indexing/fulltext-index ; concurrency: https://docs.falkordb.com/design/concurrency ; query timeout: https://docs.falkordb.com/commands/graph.query
- FalkorDB Canvas (web component, `setData` replaces graph): https://docs.falkordb.com/browser/canvas ; npm `@falkordb/canvas` 0.3.3
- Sigma.js 4.0.1, graphology, `@react-sigma/core` 5.0.6; Cytoscape 3.34.3; `@xyflow/react` 12.12 (npm, 2026-10-13)
- ts-morph 28.0.0 (npm); tree-sitter 0.25.1 / web-tree-sitter 0.27.1 (npm); trade-off sources: https://aide.dev/blog/llm_lsp , https://www.npmjs.com/package/lineage-ts
- What FalkorDB judges rewarded: docs/research/IDEA-RESEARCH.md §1 (FalkorDB recaps)

### Owner answers (2026-10-14)
1. **Domain:** the owner has the subdomain lined up and will buy it when told. Buy it **Thu evening**, so DNS settles before the Fri 12–3 PM deploy.
2. **Second Cursor account:** both accounts are already set up. Use it in a second Cursor window when the first account hits limits.
3. **AI in the product:** decide **Thursday** at the P2 checkpoint.
4. **Visual direction:** still open; mockups at the P2 checkpoint as planned.
5. **Blog:** no platform is specified in any rule (overview: "Write a blog post about your project"). Any public platform works. Proposal: dev.to or Hashnode for reach, cross-posted, and linked from the README.
6. **Video:** the owner's voice.
7. **Name:** Switchboard, kept.
8. **Owner lean (2026-10-14, 12 AM):** the plain-English briefing summary (F20) is a good AI addition. Revisit later today.
9. **Pending owner decision:** add a **with/without benchmark** as Core: the same multi-agent task run 10× without and 10× with Switchboard on the demo repo, counting broken builds, failing tests and overwritten work. The result goes in the README and video. Testing layers: (1) query tests against planted traps in the demo repo, (2) a deterministic scripted replay, (3) a live run with real agents plus dogfooding, (4) the benchmark, plus a `/judge` page with three query buttons.
