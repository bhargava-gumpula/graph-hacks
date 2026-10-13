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

## The idea: a "company brain" for a public open-source project
Treat a public GitHub project (possibly FalkorDB's own repos) as "the company". Ingest commits, pull requests, reviews, issues, discussions, docs and releases into one FalkorDB graph.
- **Graph contents:** people, PRs, files, components, issues, decisions (pulled from discussion text by Claude, each linked to its source comment), and releases. Facts carry timestamps.
- **What it does:**
  - Answers who actually knows or owns each part (from activity, with recent work weighted more, compared with the declared owners file).
  - Shows what's in progress and what's blocked, and what changed in an area over time.
  - Answers why a decision was made, with the source.
  - When a new issue arrives, finds the component, similar past issues and their fixes, and the best reviewer, then drafts a triage reply with sources (a draft, not posted).
  - Updates incrementally as new GitHub events arrive.
  - Stores human corrections ("Carol owns that now") as facts that override the computed answer.
- **Planned demo:** a new issue arrives, and the agent shows the component, the similar past bug, the real expert and a drafted reply, with the reasoning path highlighted on the graph.
- **Intended tracks:** Company Brain (main), Connected Data, possibly Memory.
