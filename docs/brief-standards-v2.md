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

## The idea: rfc-brain, a graph that knows which internet standards are still current and who decided them
The IETF has published 9,847 RFCs (internet standards) over 50 years. Standards get replaced, but code, docs and AI answers keep citing the dead ones (e.g. RFC 2616 for HTTP, which was obsoleted in 2014 and then split into seven successor RFCs). This project loads the IETF's public record into one FalkorDB graph. An agent uses it to (a) give the current rule with the supersession path and the decision record as evidence, and (b) scan real codebases for citations of obsolete standards and propose the replacements.

- **Data (all verified live, free, no scraping):**
  - rfc-index.xml (9,847 RFCs, with 1,543 obsoletes and 2,161 updates relations).
  - The IETF Datatracker API: 478k normative and informative citation edges; 141k author records with affiliation; 1,128 working groups with chair roles; and, for each RFC's draft, the IESG ballot positions with comments and the document event history.
  - Full RFC text via rsync.
  - Mailing-list archives are deliberately not used (they're bot-blocked); Datatracker ballots are the decision record.
- **Graph model:**
  - Nodes: `(:RFC {number, title, status, published})`, `(:Draft)`, `(:Person)`, `(:Group)`, `(:Area)`, `(:Ballot {position, comment, date})`, `(:Section)`.
  - Edges: `OBSOLETES`, `UPDATES`, `REPLACES` (draft→RFC), `CITES {normative}`, `AUTHORED {affiliation}`, `CHAIRS {from,to}`, `IN_GROUP`, `BALLOTED`, `HAS_SECTION`.
- **Queries that need the graph (each shown as Cypher in the UI):**
  1. **Current rule:** variable-length `OBSOLETES|UPDATES` walk to all live leaves. RFC 2616 fans out to 9110, 9111 and 9112 through several paths, a tree, not a lookup. Also **"as of a date"** (the walk filtered by `published`), e.g. "what was the rule in 2012?"
  2. **Stale-citation blast radius:** which *current* RFCs still normatively cite an obsoleted RFC, at any depth, ranked by PageRank over `CITES`.
  3. **Who decided and who knows:** RFC → its draft → ballots (the Area Director positions and comments) and authors and working-group chairs, weighted by recency.
  4. **Grounded retrieval:** full-text search over all RFCs, plus vector search only over *current* RFC sections (a local embedding model). Hits on obsolete text are walked forward to their live successors, so the agent cannot cite dead text. When the successor is a set of RFCs, the agent shows all of them and ranks them by section similarity instead of guessing a section mapping.
- **Agent + action (Track 1):** Claude chooses among three typed MCP tools (`current_rule`, `who_decided`, `scan_repo`). `scan_repo` runs a regex over a public repo for RFC references, resolves each one through the graph, and outputs a PR-ready markdown report: every obsolete citation, its live replacements, and the path. It is packaged as a CLI and a GitHub Action.
- **Honesty rules:**
  - "Obsoleted" is not presented as "wrong": UPDATES is shown as amendment, not replacement.
  - The comparison baseline is a fair RAG with status metadata, and the demo shows where it still fails (multi-RFC fan-out, citations at depth, and "who decided").
- **Demo (2 min):**
  1. Cold open: "Your code cites a rule that died in 2014."
  2. Run `scan_repo` on a well-known open-source repo (curl or Go's net/http), showing the real obsolete citations found, with paths animated.
  3. Ask "who decided this?" and get the ballot positions and Area Director comments, with links.
  4. The ecosystem-wide stale-citation leaderboard (a graph-only query).
  5. A raw Cypher query shown.
- **Scope cuts:** no mailing-list mining, no PEP adapter, no embeddings of obsolete RFCs.
- **Cost:** about $25–40 of Claude (Sonnet for answers, Haiku for ballot summaries); embeddings local.
- **Intended tracks:** Company Brain (main: "tracing decisions to their source", "who owns/knows what", "keeping knowledge current", "answers with sources"), plus Connected Data. The blog side prize too.
