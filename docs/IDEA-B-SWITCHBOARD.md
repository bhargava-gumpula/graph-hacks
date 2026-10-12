# Idea B: Switchboard (deep dive, 2026-10-11, notes only)

**One line:** a shared brain for a team of AI coding agents. Every agent reads and writes one FalkorDB graph through MCP, so they remember across sessions, don't collide, and hand off work without a human relaying messages.

**Tracks:** primary **Track 2 Agent Memory and Coordination (PS5)**; also **Track 1** (graph queries and algorithms used as MCP tools that decide what an agent is allowed to do).

## The problem (the owner's real story)
Running several Claude Code chats on one project: they forget everything after /clear, two of them edit the same file, a new chat doesn't know yesterday's decisions, and the human ends up copy-pasting context between them. Today's fixes are flat notes files and an "orchestrator" chat doing it all by hand.

## Graph model (sketch)
```
(Agent)-[:WORKS_ON]->(Task)-[:PART_OF]->(Goal)
(Agent)-[:CLAIMS {since, until}]->(File)
(File)-[:IMPORTS]->(File)            # parsed from code, no AI
(File)-[:IN]->(Module)
(Task)-[:BLOCKED_BY]->(Task)
(Task)-[:HANDED_OFF {note}]->(Task)
(Decision {why, at})-[:AFFECTS]->(File|Module)
(Decision)-[:MADE_BY]->(Agent) ; (Decision)-[:SUPERSEDES]->(Decision)
(Lesson {text})-[:ABOUT]->(File|Module|Command)   # "run X before Y"
(Event {kind, at})-[:BY]->(Agent) ; (Event)-[:ON]->(File|Task)   # the episode log
```
Memory types the track asks for, word for word:
- **Episodic:** the Event log (what happened, when, by whom).
- **Semantic:** Decisions and Lessons (what is true and why), with time, and SUPERSEDES when they change.
- **Procedural:** Lessons about how to do things (build steps, gotchas), served to every future agent.
- **Per tenant:** one FalkorDB graph per project (multi-graph), so projects never mix.

## What the graph uniquely does (the "not decoration" proof)
1. **Conflict detection by dependency, not just by filename.** Agent A claims `auth.ts`; Agent B wants `login.tsx`, which imports `auth.ts` two hops away. A file lock misses this; one graph traversal catches it: "warning: Agent A is changing something you depend on, coordinate first."
2. **Context briefing:** "I'm about to work on payments": the graph returns the decisions, lessons, recent changes, open tasks and who touched it, ranked by graph distance, in one query instead of the agent reading the whole history.
3. **Impact of a decision:** "We switched from REST to tRPC": which files, tasks and agents does this affect? (traversal)
4. **Scheduling:** which tasks are unblocked and touch no claimed area, so they can run in parallel safely? (graph algorithm: components and paths)
5. **Trace:** "Why did agent 3 do this?" → Event → Task → Decision → the message that caused it.

## MCP tools the agents call (draft)
`register_agent` · `brief_me(area)` · `claim(files)` → OK or a conflict path · `release` · `record_decision` · `record_lesson` · `handoff(task, note)` · `next_task()` · `why(file|change)`

Plus Claude Code **hooks** that log edits automatically, so memory updates without agents having to remember to call anything.

## The demo (about 2 minutes)
1. Three Claude agents get one goal ("add login to this small app"). The dashboard graph lights up as they register, split tasks and claim files.
2. Agent B tries a file that depends on Agent A's claim → the conflict path is highlighted in red → B picks a different task.
3. Agent A records "use bcrypt, not sha256" → it appears linked to the files it affects.
4. **The moment:** we kill Agent A mid-task. A brand-new agent starts, calls `brief_me`, and continues exactly where A stopped, mentioning the bcrypt decision, with no human relaying anything.
5. Ask "why does login use bcrypt?" → the answer plus the highlighted path back to the decision and the agent that made it.

## Existing tools and how we differ
| Tool | What it does | What it lacks |
|---|---|---|
| MCP Agent Mail | Inboxes plus advisory file leases for coding agents (SQLite + Git) | No dependency awareness; memory is a message archive |
| MemoryGraph, the official KG memory server, hilyfux knowledge-graph | Persistent memory, mostly for **one** agent | Little real-time multi-agent coordination |
| Beads | A task and dependency graph for agents | No decisions or lessons memory, no conflict detection |
| Claude Code's own team features | Shared task list and messaging inside Claude Code | Locked to one tool; no long-term graph memory |
Our angle: **the graph decides** (dependency-aware conflicts, ranked briefings, decision impact). It works with any MCP agent (Claude Code, Codex, Cursor).

## Scope for 4 days
- Must: FalkorDB schema, MCP server (about 8 tools), import parser for one language (TS/JS), hooks, a live dashboard (graph view + event feed), the demo script, README with the graph model + Cypher, demo video.
- Nice: Graphiti for temporal facts, a second language, a hosted dashboard on the other Mac.
- Skip: auth, a multi-machine setup beyond the demo.

## Cost ($100 Claude)
The graph itself needs no AI (parsing plus tool calls). Claude is spent on: the demo agents doing real work (the biggest cost; use Sonnet, keep the target app tiny) and optional summaries of decisions. Rehearsals cost money, so record the best run.

## Risks
- **The demo is technical.** Mitigation: the dashboard *is* the demo, with big visuals of the conflict path and the "new agent resumes" moment.
- **Live multi-agent runs are flaky.** Mitigation: a scripted target task, a recorded backup run.
- **"It's just a notes file":** answered by the dependency-conflict and decision-impact queries, which notes can't do.
- **Rule 13 (AI-generated):** the owner must understand the graph model and queries; keep a decisions log.
