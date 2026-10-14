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

## The idea: Tool Atlas, a typed graph of agent tools for planning tool chains and remembering what worked
Agents connected to many MCP servers get hundreds of tool schemas stuffed into context: slow, expensive, and error-prone. Tool Atlas loads every tool from ~40 public MCP servers (official reference servers, Playwright, GitHub, fetch, sqlite, etc., plus the official MCP registry's server metadata) into a typed FalkorDB graph. For a task, the agent plans a tool *chain* as a path over input and output types, loads only the 3–4 schemas it needs, and stores chains that worked as reusable procedures.
- **Graph model:**
  - Nodes: `(:Server)`, `(:Tool {name, schema_hash, embedding})`, `(:Type)` (normalised JSON-schema shapes such as `url`, `path`, `issue_id`, `table`), `(:Procedure)`, `(:Run)`, `(:Tenant)`.
  - Edges: `EXPOSES`, `CONSUMES`, `PRODUCES`, `CO_USED {count}`, `STEP {order}`, `SUCCEEDED`/`FAILED`, `ALLOWED_FOR` (tenant permissions as edges).
- **Core queries:**
  - **Plan:** shortest paths over `CONSUMES`/`PRODUCES` from the types the agent has to the type it needs (`algo.SPpaths`, with the max length as a chain budget).
  - **Find tools:** hybrid vector + full-text search over tool descriptions, restricted in the same query to tools that are reachable and permitted for this tenant.
  - **Reputation:** PageRank on `CO_USED` for tool reputation.
  - **Reuse first:** before planning, look for a precedent `(:Procedure)-[:STEP*]->(:Tool)`.
  - **Memory:** each run writes a `Run`, updates success and failure counts, and promotes successful chains to `Procedure` (procedural memory, one graph per tenant).
- **Demo:**
  1. A counter: "Tools in catalog: 612. Schemas in context: 3. Plan found in 2 ms: fetch → extract_table → create_issue."
  2. The same task with all schemas in context: a huge token count and a wrong tool pick.
  3. Rerun the task the next day: "reused Procedure #14 (succeeded 3/3)".
- **Data:** the official MCP registry plus a `tools/list` scrape of public servers (no logins). Around 20 schemas may be vendored if some servers won't start without credentials.
- **Prior art acknowledged:** a Neo4j research README ("Unified-MCP-Tool-Graph").
- **Intended tracks:** Agents That Act on Connected Data (main: "tool selection through MCP", "graph queries and algorithms as agent tools"), plus Agent Memory and Coordination (procedural memory, per-tenant memory).
