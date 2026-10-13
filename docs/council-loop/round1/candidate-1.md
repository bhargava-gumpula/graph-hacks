# Council brief: one hackathon idea

This brief describes one idea, with no scores, risks or recommendations attached. Find the strengths and flaws yourself.

## The hackathon (facts)
- **Graph Hacks: Context for AI Agents**, run by WeMakeDevs and sponsored by FalkorDB (an open-source, in-memory graph database queried with Cypher). Online. About 3,000 registrants. Judges are presumably WeMakeDevs and FalkorDB people. **No judging rubric has been published.**
- **Timing:** coding starts Tue Oct 14, 11:31 AM PT. The deadline is Sat Oct 18, 11:29 AM PT (about 4 days).
- **Three tracks, one prize each; a project may enter several:**
  1. *Agents That Act on Connected Data* (iPhone 18 Pro): multi-hop reasoning, graph queries and algorithms as agent tools, tool selection via MCP, actions driven by the graph, explainable results.
  2. *Agent Memory and Coordination* (PS5): episodic, semantic and procedural memory; persistent history; shared state and handoffs between agents; high-concurrency reads and writes; separate memory per user or tenant.
  3. *Company Brain* (M6 Mac Mini): docs, tickets and chats in one graph; who owns and knows what; tracing decisions to their source; keeping knowledge current; answers with sources.
- **Rules:**
  - FalkorDB must be central: "if the product still works once FalkorDB is taken out, the graph is decoration."
  - Data must be public, synthetic or your own.
  - AI coding assistants are allowed but must be disclosed, and entrants must be able to explain the graph model, queries and architecture.
  - Fully AI-generated projects without meaningful contribution may be rejected.
- **Submission:** a public repo, a README with setup and the graph model, the Cypher queries, a demo video, and a live deployment (preferred) or full local setup.

## The builder
- One person who directs several Claude Code agents in parallel (Claude Code runs on their subscription). They will build with AI assistance and must be able to explain every design decision.
- Product runtime budget: about $30 of Claude API spend over the whole event, including the live demo. Anthropic has no embeddings API, so any embeddings are computed locally.
- Demo host: a spare always-on Mac running FalkorDB in Docker, exposed through a Cloudflare Tunnel.
- Their deciding question includes **real-world usefulness**: who would actually use this?

## The idea: a dependency-aware traffic controller for parallel Claude Code agents
A FalkorDB-backed service plus Claude Code hooks that stops several Claude Code agents, working at once on one repository, from breaking each other's work. It supports Claude Code only (no Cursor or Codex).

- **Graph model (one graph per repository):**
  - `(:File)-[:IMPORTS]->(:File)` and `(:File)-[:DEFINES]->(:Symbol)<-[:REFERENCES]-(:File)`, parsed with tree-sitter for one language (TypeScript) and refreshed on every edit.
  - `(:Agent)-[:CLAIMS {expires_at}]->(:File)`: claims expire after 15 minutes unless renewed by further edits.
  - `(:Agent)-[:WORKS_ON]->(:Task)-[:TOUCHES]->(:File)`, `(:Decision {text, reason})-[:AFFECTS]->(:File|:Symbol)`, `(:Event {tool, ts})` linked to agent and file.
- **What it does:**
  - **Blocks conflicting edits.** A Claude Code `PreToolUse` hook on Edit/Write asks the graph whether the target file is claimed, or whether it reaches a claimed file within 3 hops of IMPORTS/REFERENCES. If it does, the hook denies the edit and returns the exact dependency path (e.g. `api/user.ts → REFERENCES → types/User → DEFINED IN → models/user.ts (claimed by agent-2)`), so the agent can wait, pick another task, or coordinate.
  - **Parallel-safe task sets.** For a list of planned tasks, it runs weakly connected components on the subgraph of the files each task touches, and reports which tasks can run at once.
  - **Kill-and-resume briefing.** A `SessionStart` hook gives a new agent a briefing for its task's area from the graph: the decisions that affect those files, recent events, and open claims.
  - **"Why" trace.** "Why is this function like this?" returns the decision path, Symbol ← AFFECTS ← Decision ← recorded by Agent during Task.
  - A live web canvas draws only the subgraph being reasoned about (claims, the blocked path, the components) and shows the Cypher that ran.
- **Data:** the builder's own repository. The project is built with itself during the hackathon, and the event log from those 4 days is published as a dataset.
- **Claude API use:** almost none at runtime (hooks and graph queries are deterministic); Claude is used only to summarise the briefing text.
- **Planned 2-minute demo (pre-seeded repository, scripted, recorded):**
  1. Three Claude Code agents get three tasks; the canvas shows two components, so two tasks run in parallel and one waits.
  2. Agent B tries to edit a file that imports a type agent A has claimed; the hook denies the edit and the path is drawn on the canvas.
  3. Agent A records a decision. Agent A is killed; a fresh agent starts, receives the briefing and continues.
  4. "Why is `User.email` optional?" is answered with the decision path highlighted.
- **Out of scope:** other editors, multi-machine sync, merging, semantic conflict detection beyond imports and references.
- **Intended tracks:** Agent Memory and Coordination (main), Agents That Act on Connected Data.
