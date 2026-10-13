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

## The idea: Standards Brain, "is this still the rule?", for the IETF
A company brain for the IETF (the body that writes internet standards): 9,000+ RFCs, drafts, authors, working groups and mailing-list decision threads in one FalkorDB graph. An agent answers "what is the *current* rule on X, who decided it, who knows it, and which of my documents still cite an obsolete one", with the supersession path as evidence.
- **Graph model:**
  - Nodes: `(:Document {rfc, title, status, published})`, `(:Draft)`, `(:Person)`, `(:Group {wg})`, `(:Area)`, `(:Section)` (chunks with embeddings), `(:Thread)` (mail-archive URLs).
  - Edges: `OBSOLETES`, `UPDATES`, `REPLACES` (draft→RFC), `AUTHORED {order, affiliation}`, `IN_GROUP`, `IN_AREA`, `CITES` (from RFC references), `DISCUSSED_IN`, `HAS_SECTION`.
- **Core queries:**
  - **Current truth:** a variable-length walk along `OBSOLETES|UPDATES` from any document to the documents that nothing obsoletes.
  - **Authority:** PageRank over `CITES`.
  - **Who knows a topic:** Person→AUTHORED→Document→IN_GROUP.
  - **Retrieval:** hybrid vector + full-text search over sections, then continue into the supersession chain so it never returns a dead RFC.
- **Demo:**
  1. Split screen. Plain RAG cites RFC 2616 (obsolete) for an HTTP question, while the agent follows 2616 → 7230–7235 → 9110/9111/9112, cites the current section, names the authors and working group, and links the decision thread, with the path drawn on a graph canvas.
  2. **Action:** point it at a public repo or doc set, and it produces a report listing every reference to an obsoleted RFC with its replacement, plus a "current" badge where no OBSOLETES path exists.
- **Dataset:** the IETF Datatracker API (about 1,543 obsoletes relations, document authors with affiliations, groups), rfc-index.xml and mailarchive.ietf.org. No LLM cost at ingest. Claude is used only for answers and for extracting a few hundred decision threads.
- **Generality:** a small adapter shows Python PEPs ingesting into the same model.
- **Intended tracks:** Company Brain (main), Connected Data.
