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
- One person who directs several Claude Code agents in parallel (an "agent graph" run by an orchestrator chat). They will build with AI assistance.
- Budget: $100 of Claude API credits. Demo host: a spare Mac behind a Cloudflare Tunnel.
- Prize preference: the Mac Mini or the PS5. They also like the concept of the iPhone track.
- Their deciding question includes **real-world usefulness**: who would actually use this?

## The idea: a shared graph memory for teams of AI coding agents
An MCP server backed by FalkorDB that several AI coding agents (Claude Code, Codex, Cursor and so on) read and write while working on the same codebase.
- **Graph contents:** agents, tasks, goals, files and modules linked by import relationships (parsed from code), file "claims" (which agent is editing what), decisions with reasons linked to the files they affect, lessons learned ("run X before Y"), and an event log of who did what and when. One graph per project.
- **What it does:**
  - Warns an agent when the file it wants depends on a file another agent is editing.
  - Gives a starting agent a briefing on an area (relevant decisions, lessons, recent changes).
  - Shows what a decision affects.
  - Lists which tasks are safe to run in parallel.
  - Answers "why was this done?" by tracing back to the decision.
  - Editor hooks log edits automatically.
- **Planned demo:**
  1. Three live agents split a small task and claim files.
  2. One agent is warned about a dependency conflict.
  3. A decision is recorded.
  4. One agent is killed mid-task and a fresh agent resumes from a graph briefing.
  5. A "why" question is answered with the path highlighted.
- **Intended tracks:** Memory and Coordination (main), Connected Data.

