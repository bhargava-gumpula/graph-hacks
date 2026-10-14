# Switchboard: competitor sweep

Researched 2026-10-14. Stars and "last push" come from the GitHub API on that date (verified) unless marked. Feature claims come from READMEs or docs that I read; anything from a directory listing, blog or search snippet only is marked **(unverified)**. "Unclear" means the README did not say.

Switchboard under test: agents claim files or functions; a parsed import/call graph warns or blocks edits that touch code another agent is changing; briefings for a fresh or replacement agent; why-trace (change -> task -> decision -> agent); parallel-safe tasks via graph components; FalkorDB; MCP plus editor hooks.

## Feature matrix

Legend: Y = present, P = partial or weak, N = not present / not mentioned, ? = unverified or unclear.

| Tool | Stars / last push | Claims / locks | Dependency-aware conflicts | Decision / lesson memory | Handoff / resume brief | Why-trace | Parallel-safe scheduling | Graph DB | Agents |
|---|---|---|---|---|---|---|---|---|---|
| **Nerveplane** | 1 / 2026-08-28 | P (scope registration, same-file and same-package conflicts) | P (hand-declared YAML service graph, contract diffs, transitive dependents; not a parsed code graph) | Y (decision ledger, remember/recall) | P (memory auto-injected at session start) | P (decision ledger queryable by file/task) | **Y** (greedy graph-coloring batches + merge order; paper arXiv 2610.07261) | No (SQLite) | Claude Code (hooks), Codex, opencode, any MCP |
| **wit** | 46 / 2026-03-27 | Y (symbol-level, advisory) | **P+** (three checks incl. "dependency chain": intent targets a caller of a locked symbol; how the graph is built is not documented) | N | N (session hook loads coordination state) | N | N | No (SQLite) | Claude Code plugin, Cursor, Copilot, Devin, anything with shell/JSON-RPC; TS/JS/Python only |
| **Collide MCP** | no public repo | Y (declared intents, symbol-level, expiring) (unverified) | P (symbol-level collisions; no call graph stated) (unverified) | P (anchored team memory) (unverified) | Y (`get_briefing`) (unverified) | ? | N | ? (Merkle tree of symbols) | Claude Code, Codex, Cursor, ChatGPT (unverified). Invite-only workspaces |
| **Foremerge** | 539 / 2026-10-04 | Y (advisory leases on declared scopes) | P (intent-vs-intent semantics; author says tree-sitter code graph is roadmap, not built) | N | N | P (decision log audit trail) | N | No (SQLite) | Claude Code, Codex, Cursor. 18 MCP tools, Rust |
| **Menhir** | 3 / 2026-10-12 | N found in README (single-operator design) | P (blast radius: dependents, callers, affected tests, but not cross-agent) | **Y** (governed decisions, failed approaches, superseded history) | **Y** (plans, reviews, handoffs as typed artifacts) | **Y** (provenance to source episode, files, tests) | N | **Neo4j** (+ Graphiti) | MCP clients; hooks mark files dirty. 52 tools |
| **MCP Agent Mail** | 2,203 (Python, unmaintained) + 197 (Rust) / 2026-10-08, 2026-10-13 | Y (advisory leases, glob patterns, pre-commit guard) | N (graph analytics come from Beads, not code) | P (threads, searchable archive) | P (inbox/threads) | N | P (via Beads `bv` critical path) | No (Git + SQLite FTS5) | Claude Code, Codex, Gemini CLI, Copilot CLI, Cursor/Windsurf/Cline configs |
| **Beads (`bd`)** | 27,857 (gastownhall/beads) / 2026-10-14 | P (`--claim` assigns task atomically; no file claims) | P (task dependency graph, not code) | P (issues, memory decay summaries) | P (`bd ready`, durable task state) | N | **P+** (`bd ready` = unblocked tasks) | Dolt (SQL, not graph) | Claude Code, Codex, Droid, Cursor, others via `bd setup` |
| **Vibsync** | 0 / 2026-10-10 (hosted service) | P (advisory file claims, `check_conflicts`) | N | Y (`remember`/`recall`, scoped, attributed) | **Y** (`onboard` brief: open tasks, claims, questions) | N | N | ? | Claude Code, Cursor, Codex, Copilot (README) |
| **Bothread** | 13 / 2026-10-07 | Y (exclusive claims blocked; git state) | N | P (live thread) | N | N | N | No | Claude Code, Cursor, Antigravity, Gemini CLI, Codex, OpenCode. Claude Code hooks |
| **Befall MCP** | 0 / 2026-09-16 | Y (glob claims, TTL, git dirty-path heartbeats) | N | N | P (task board claim/handoff) | N | N | ? (hosted API) | Claude Code, Codex CLI, Cursor |
| **Junto memory** | 5 / 2026-10-13 | Y (atomic locks, stale detection) | P (overlap detection; "dependency signaling" undefined) | Y (KB, learnings, gotchas, MongoDB + ChromaDB) | **Y** (handoff notes, standup) | N | N | No (MongoDB + Chroma) | Claude Code, Cursor, any MCP. Self-reported 6-agent production use (unverified) |
| **CoordMCP** | 1 / 2026-02-21 | Y (file locks) | N | Y (decisions, tech stack) | ? | N | N | ? | OpenCode, Cursor, Claude Code, Windsurf, Antigravity |
| **agent-locks** | not found | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **Unverified: no project with this exact name found.** Near matches: AGNT-LOCK (2 stars), agent-coord (1), mcp-lock-manager, LockRe |
| **agenthold** | 2 / 2026-07-07 | P (register/claim/release on shared state keys; optimistic concurrency) | N | P (versioned shared state) | N | N | N | No | Claude, Cursor, CrewAI (not file-oriented) |
| **AgentRoom** (ICML 2026 workshop paper) | repo not located | Y (file-level claim/status/broadcast MCP tools) | N (CRDT merge, no semantic awareness) | N | N | N | N | No (CRDT FS) | Codex CLI, Claude Code (per paper/blog, unverified). Paper arXiv 2608.23740 |
| **Neohive** (fakiho) | 6 / 2026-10-10 | Y (`lock_file`) | P (`declare_dependency` is task-level) | Y (`log_decision`, KB) | Y (`handoff`) | N | P (workflow pipelines with dep graphs) | No (JSON files) | Claude Code, Gemini CLI, Cursor, Copilot, Codex. BSL license |
| **threadctx** | 1 / 2026-07-29 | N | N | Y (shared memory) | P | N | N | No (JSON file / cloud) | Claude Code, Cursor, rule files for Copilot/Windsurf/Cline/Gemini |
| **ByteRover (Cipher / brv)** | 4,955 / 2026-06-25, **repo archived** | N | N | Y (context tree, team workspace) | P | N | N | No (context tree, Git-style vc) | Claude Code, Cursor, Gemini CLI, 20+ per listing (unverified) |
| **MemoryGraph** (memory-graph/memory-graph) | 251 / 2026-09-16 | N | N | Y (graph memory) | N | N | N | SQLite default; Neo4j, Memgraph etc. | Any agent via CLI/MCP. (Python gregorydickson/memory-graph repo not found; may have moved) |
| **hilyfux knowledge-graph** | 20 / 2026-06-12 | N | N | Y (per-module notes, blind spots) | P (session-start snapshot) | N | N | No (files + jq) | Claude Code (hooks), Codex via MCP |
| **Graphiti MCP** | 31,726 / 2026-10-14 | N | N | Y (temporal facts, episodes) | N | P (bi-temporal edges, provenance) | N | Neo4j, **FalkorDB**, Kuzu | Claude Desktop, Cursor, any MCP |
| **FalkorDB code-graph** | 348 / 2026-10-12 | N | P (CALLS/DEPENDS_ON queries, no agent awareness) | N | N | N | N | **FalkorDB** | Web UI / CLI / GraphRAG chat; Python, Java, C# only |
| **claude-flow / Ruflo** | 74,575 / 2026-10-13 | P (swarm memory namespaces) | N | P (shared memory, AgentDB) | P | N | P (topologies: mesh, hierarchical) | No (AgentDB/HNSW) | Claude Code, Codex |
| **Claude Code agent teams** | first-party, experimental | P (task claiming uses file locking; docs say to give teammates different files) | N | N | N (docs: no resume of in-process teammates) | N | P (task dependencies; lead plans split) | No | Claude Code only |
| **Cursor** (3.x /multitask, worktrees, background agents) | first-party | P (isolation via worktrees, not claims) | N | N | N | N | P (subagent fan-out) | No | Cursor only. Details from secondary sources (unverified) |
| **Codex** (app, worktrees, cloud tasks) | first-party | P (worktree/sandbox isolation) | N | N | N | N | P (subagents) | No | Codex only. Secondary sources (unverified) |
| **Paseo** (getpaseo/paseo) | 20,802 / 2026-10-14 | N | N | N | **Y** (`/paseo-handoff`, `/paseo-loop`) | N | P (agents and worktrees managed by hand) | No | Claude Code, Codex, OpenCode. Orchestrator of agents, not a code-level coordinator |

## Other tools found (not on the original list)

| Tool | Link / stats | Why it matters |
|---|---|---|
| Shepherd (Korso) | github.com/Korso-AI/Shepherd, 9 stars, 2026-09-25 | Hosted hub (Fastify + Postgres) with leases, locks, live presence over MCP. Claims only; no code graph or memory |
| Claim Plane (papers 2607.21909, 2608.00947) | arXiv | Pre-write admission control, dynamic scope. Research; no shipped tool found |
| MPAC (arXiv 2604.09744) | arXiv | Intent pre-announcement protocol. Research |
| agent-coord (ThatHunky) | 1 star, 2026-06-26 | PreToolUse hook that blocks edits to locked files (real enforcement on Claude Code) |
| Agent-MCP (rinadelph) | 1,305 stars, 2026-03-28 | "Knowledge graph" framing, file-lock hook, task graph. Stale since March |
| swarm-tools (joelhooks) | 747 stars, 2026-07-30 | File reservations + Swarm Mail. Claims, no code graph |
| Swarlo / agentsync-mcp / agent-claim-mcp / Task Graph MCP / Coordinaut / BeadHub | PyPI/Glama listings (unverified) | Same claim-and-lock category, SQLite or git based |
| Memtrace | github.com/syncable-dev/memtrace-public, 494 stars, 2026-10-13 | Bi-temporal structural code graph over MCP, zero LLM calls. No multi-agent claims found |
| codebase-memory-mcp (DeusData) | 46,526 stars, 2026-10-13 | Call-graph MCP. Context only, no coordination |
| GraphPilot / knowing / code-impact-mcp | 17 / 20 / unknown stars | Caller and blast-radius MCP tools. No cross-agent claims |
| varve (varve-sh) | 9 stars, 2026-07-30 | Decision memory linking commits back to in-scope decisions. Single-agent |
| DEG (degraph on PyPI) | listing (unverified) | Decision-evidence graph with trace/impact operations |
| Aura (auravcs) | listing (unverified) | AST-level change tracking with 29 MCP tools; conflicting licence info |
| dkod-engine | 1 star, **archived** | Tree-sitter overlays instead of locks |

## Graph Hacks 2026 entrants (WeMakeDevs x FalkorDB)

Event page (fetched): Oct 15-18, 2026, tracks: 01 Agents That Act on Connected Data, 02 Agent Memory and Coordination, 03 Company Brain. A search snippet for the same page said "September"; the fetched page text says Oct 15-18, so I trust that. Rule (per entrant READMEs): FalkorDB implementation must be new work written during the event. No public gallery was listed. GitHub search was rate-limited partway, so the list below is probably incomplete.

| Repo | State on 2026-10-14 | Overlap with Switchboard |
|---|---|---|
| tuoitrevohoc/graphmem | Plan only, zero code | **Highest.** "Shared memory for coding agents" on FalkorDB: Fact/Decision/Task/Agent nodes, `decided_by`, `depends_on`, `supersedes`. Demo traces requirement -> decision -> code. Covers memory and why-trace; no claims, no code parsing |
| pintu544/blastradius | Scaffold only | FalkorDB code graph (files, functions, imports, commits) with call-graph blast radius. Security-scan focus, single agent |
| volfiros/axon-brain | Design phase | Decision graph that flags new work against past decisions. Company brain; not coordination |
| aniruddhaadak80/meridian-graphhacks, cortex, unspool | Repos exist | 4-agent incident-triage crew on a FalkorDB graph; shared memory. Different domain |
| renigat7-cpu/graph-hacks-2026, uzielguti-dev/hippocampus, others | Repos exist | Generic agent-memory layers |

I found no entrant building claims + code dependency graph for coding agents. The risk is that some will start on Oct 15 (graphmem is the likeliest to collide in a judge's mind).

## Notes per competitor

- **Nerveplane**: the closest functional match across claims, scheduling and memory. Strong paper with a benchmark (NP-Bench). Weak spots: scopes are hand-declared, the dependency graph is a YAML service graph, SQLite, 1 star, FSL licence. Scheduling is on declared scopes, not parsed code.
- **wit**: only tool I verified that checks "caller of a locked symbol" before an edit. Advisory only, no memory, no briefings, no graph database, three languages. Last pushed March, so appears dormant.
- **Collide MCP**: product page claims symbol-level tracking, `get_briefing`, intents, optional write gate. Invite-only, closed source, so cannot be verified or cloned. Benchmarks are vendor-reported.
- **Foremerge**: most popular new entrant (539 stars). Explicitly says a tree-sitter code graph for dependency conflicts is future work. If it ships that, it covers the claim half of Switchboard.
- **Menhir**: the closest on the graph + memory half: Neo4j graph with code structure, decisions, failed approaches, handoffs, blast radius, provenance. Built for a single operator; I found no multi-agent claims in its README. 3 stars.
- **MCP Agent Mail**: the incumbent for file reservations and messaging, with a git pre-commit guard. No code awareness. Python version is no longer maintained; Rust successor active.
- **Beads**: dominant task graph (27.9k stars), already used by Agent Mail. Task dependencies only; backend is Dolt. A judge may ask "why not Beads?" for parallel-safe scheduling.
- **Vibsync**: hosted; memory, task board, advisory claims, onboard brief. No dependency awareness. Repo is just 0 stars.
- **Bothread / Befall / CoordMCP / agent-coord / AGNT-LOCK**: claims category. Befall adds git dirty-path heartbeats so unclaimed overlaps are still flagged, which is worth stealing. None parse code.
- **Junto memory**: closest on memory + locks + handoff notes in one product. MongoDB + Chroma, no code graph.
- **Neohive**: kitchen sink (locks, decisions, handoff, task dependency, voting) over JSON files. BSL licence.
- **AgentRoom**: paper-level contribution (coordination matters more than CRDT merge or parallelism). I could not find its repo; the README link I tried returned 404. Useful as citation, not a shipped competitor.
- **agent-locks**: unverified. No repo by that name; nearest are AGNT-LOCK and agent-coord.
- **threadctx / ByteRover / MemoryGraph / hilyfux**: single-agent or team memory. ByteRover repo is archived.
- **Graphiti MCP**: FalkorDB is a supported backend. It is a library to build on rather than a rival, but a judge may see it as "memory already solved".
- **FalkorDB code-graph**: FalkorDB's own indexer (Python/Java/C# only). Switchboard could reuse its approach, but it ignores TypeScript/JS.
- **claude-flow / Ruflo**: huge, marketing-heavy swarm framework; coordination is by orchestration, not by conflict detection.
- **Claude Code agent teams**: first-party. Task claims via file locking and dependent tasks, but docs tell users to give teammates separate files; no resume for in-process teammates. This is the competitor a judge will name first.
- **Cursor / Codex**: isolation by worktrees and sandboxes, merge at the end. Semantic conflicts are left to the human. (Secondary sources.)
- **Paseo**: orchestrator for running and handing off agents across providers. No claims, no graph.

## White space

Nobody I found combines all of these in one tool:

1. Claims that are checked against a **parsed import/call graph** so an edit to a callee warns the agent that owns a caller, across Claude Code, Cursor and Codex.
2. **Graph-component scheduling** over that same parsed graph (Nerveplane schedules, but from hand-declared scopes; Beads schedules, but over tasks, not code).
3. The same graph also holding **decisions, lessons and agent identity**, giving a change -> task -> decision -> agent trace and a briefing for a replacement agent.
4. A graph database as the actual store (Menhir uses Neo4j for memory but without claims; every claim tool uses SQLite, files or git).

Each pair of these exists somewhere (wit: 1; Nerveplane: scheduling + memory; Menhir: 3 + 4; Junto: claims + memory + handoff). The full set does not.

## Threats

1. **Nerveplane (plus its paper).** Same thesis as Switchboard's scheduling claim, with a benchmark showing clean-merge rates of 9/9 versus 1/9 uncoordinated, and it also has memory and a decision ledger. A judge: "Nerveplane already schedules parallel-safe batches and has a decision ledger. What does your graph add?" Answer must be: it is derived from the parsed code graph, not hand-declared scopes, and it is traversable (why-trace, briefing). Be ready to show a case where declared scopes miss a transitive caller.
2. **Menhir (plus Graphiti).** Already a graph-database memory with decisions, failed approaches, handoffs, blast radius and provenance. A judge: "Menhir does the why and the briefing, in Neo4j." Answer: Menhir is single-operator memory; it has no live claims, no cross-agent conflict check, no scheduling.
3. **Claude Code agent teams / Foremerge / wit as a bundle.** Agent teams is native and free; Foremerge (539 stars) says its code graph is next; wit already checks callers of locked symbols. A judge: "Why not agent teams plus a lock MCP?" Answer: those tell you who touches a file; none tell a replacement agent why, or which tasks can run together. Weak point: if the dependency check is only imports, it will look like a wit clone.

Also watch graphmem (same hackathon, same pitch for memory and trace). Scaffold only today, so a demo that works end to end beats it, but expect a judge to compare.

## Positioning

Switchboard is the only tool that checks agents' edit claims against a parsed code dependency graph and keeps the decisions, lessons and agent history in that same FalkorDB graph, so it can warn before a collision, say which tasks can safely run together, and brief a replacement agent on what happened and why.

## Caveats on this research

- Star counts and push dates are GitHub API values for 2026-10-14. Feature columns for Collide, Vibsync (hosted side), Befall (hosted side), AgentRoom, Cursor, Codex, ByteRover, Aura, DEG, Task Graph, Swarlo and Coordinaut come from directory listings, blogs or papers and are not checked against source.
- The MCP registry search (registry.modelcontextprotocol.io) returned only FalkorDB's own QueryWeaver for "falkordb" and nothing for "agent coordination"; no FalkorDB-based coordination server was found anywhere. I could not reach the X/Twitter, Reddit or Hacker News threads directly (only a Show HN for Foremerge); mcp.so, glama and mcpservers.org were reached only through search results.
- GitHub repository search was rate-limited partway through, so the entrant list is probably incomplete.
