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

## The idea: npm blast radius, an agent that finds which npm packages and accounts are single points of failure for the ecosystem
In September 2025 one npm maintainer's account was phished, and malicious versions of chalk, debug and 16 other packages (about 2 billion weekly downloads) were published within hours. Days later the self-spreading "Shai-Hulud" worm hit hundreds of packages. This project models the npm dependency and listed-maintainer graph in FalkorDB and lets an agent answer: "Which packages and publishing accounts are single points of failure, and through which paths would a compromise spread?" Rankings are by package; accounts are anonymised.
- **Scope:** the runtime dependency closure of the top 2,000 most-depended-on npm packages, latest versions only.
- **Graph model:**
  - `(:Package {name, weekly_downloads, last_publish, reach, pagerank})-[:DEPENDS_ON {range}]->(:Package)`
  - `(:Account {anon_id})-[:LISTED_MAINTAINER_OF]->(:Package)`
- **What it does (graph algorithms are the core):**
  - **Reach:** the count of distinct packages that transitively depend on a package, or on anything an account can publish. Computed with a bounded reverse traversal and stored on the nodes.
  - **Load-bearing packages:** PageRank on the dependency graph.
  - **Single points of failure:** top-1% PageRank packages with exactly one listed maintainer, shown with the paths to well-known dependents.
  - **Attack replay:** select the account compromised in September 2025 (anonymised); a canvas animates the reverse traversal hop by hop with a running reach count. Framed as an illustration, not a validated model.
  - **"Am I exposed?":** paste a `package-lock.json`, and the agent returns which listed-maintainer accounts could ship code into the project **on its next update or fresh install**, and through which paths.
  - **Agent + MCP:** Claude picks among 4 typed MCP tools (`reach`, `paths_between`, `single_points_of_failure`, `lockfile_exposure`), each of which shows its Cypher, and drafts a short risk note with the paths as evidence.
- **Data:** the public npm registry and downloads APIs, plus deps.dev. Crawled on day 1 and cached, with the snapshot date stated. Numbers are labelled "listed maintainers" (org and team publishing isn't visible).
- **Claude API use:** answers and notes only. All analysis is Cypher and FalkorDB algorithms.
- **Demo:**
  1. Replay September 2025.
  2. Today's top 10 single points of failure, each with the path to a famous dependent.
  3. Paste the lockfile of a popular open-source app and see its exposure.
- **Prior art acknowledged:** "Small World with High Risks" (USENIX Security 2019). New here: the 2025 replay, the live agent and the lockfile check.
- **Intended tracks:** Agents That Act on Connected Data (main).
