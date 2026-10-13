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

## The idea: an agent that finds the npm maintainer accounts whose compromise would reach the most software
In September 2025 one npm maintainer's account was phished and malicious versions of chalk, debug and 16 other packages (about 2 billion weekly downloads) were published within hours. Days later the self-spreading "Shai-Hulud" worm hit hundreds of packages. This project models the npm ecosystem's dependency and maintainer graph in FalkorDB and lets an agent answer "whose account is a single point of failure, and through which paths would an attack spread?"

- **Scope:** the dependency closure of the 5,000 most-depended-on npm packages (an estimated 20,000–40,000 packages), latest versions only, runtime dependencies only.
- **Graph model:**
  - `(:Package {name, weekly_downloads, last_publish})-[:DEPENDS_ON {range}]->(:Package)`
  - `(:Maintainer)-[:CAN_PUBLISH]->(:Package)` (from the npm registry's maintainers list)
  - `(:Package)-[:HOSTED_AT]->(:Repo)`; `(:Advisory)-[:AFFECTS]->(:Package)` (from the public OSV/GitHub Advisory data)
- **What it does (graph algorithms are the core):**
  - **Maintainer reach:** for each maintainer, the set of packages that transitively depend on anything they can publish, and the downloads that set represents. A variable-length reverse traversal in Cypher.
  - **Load-bearing packages:** PageRank on the dependency graph, and betweenness centrality to find "bridge" packages that many dependency paths pass through.
  - **Single points of failure:** packages in the top 1% of PageRank with exactly one maintainer who can publish; shown with the paths to well-known packages that depend on them.
  - **Attack replay:** select a maintainer (e.g. the account compromised in Sept 2025); the canvas animates the reverse traversal outward, hop by hop, with a running download total.
  - **"Am I exposed?":** paste a `package-lock.json`; the agent returns which maintainer accounts can push code into this project, through which shortest paths, and which single dependency removal cuts the most of that exposure.
  - **Agent + MCP:** Claude answers questions in plain language by choosing among 4 typed MCP tools (`maintainer_reach`, `paths_between`, `single_points_of_failure`, `lockfile_exposure`), each showing its Cypher, and drafts a short risk note with the paths as evidence.
- **Data:** the public npm registry API and downloads API, deps.dev for dependents counts, OSV for advisories. Collected on day 1 with a rate-limited crawler and cached; the README lists the snapshot date.
- **Claude API use:** only for answering questions and writing notes; all analysis is Cypher and FalkorDB algorithms.
- **Planned 2-minute demo:** (1) "Replay September 2025": select the compromised maintainer, watch the spread reach well-known projects with the download counter climbing; (2) "Who is the next one?": the top 10 single points of failure today, each with the path to a famous package; (3) paste the lockfile of a popular open-source app and get its maintainer exposure plus the one dependency to remove.
- **Out of scope:** other ecosystems, historical versions, detecting malicious code, contacting maintainers.
- **Intended tracks:** Agents That Act on Connected Data (main).
