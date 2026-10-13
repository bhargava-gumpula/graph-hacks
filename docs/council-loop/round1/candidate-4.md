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

## The idea: a "knowledge freshness" brain that finds which Kubernetes docs went stale after a release, and proves why
Large projects ship releases that remove features, deprecate APIs and graduate flags, and their documentation quietly falls behind. This project builds a graph of what each doc page depends on (feature gates, API versions, CLI flags, enhancement proposals, other pages) and, when a release changes any of those, propagates the change through the graph to list every page that is now likely wrong, each with the chain of evidence back to the release note or proposal that made it wrong. It is a truth-maintenance system, a classic AI idea, applied to a company's knowledge.

- **"The company":** the Kubernetes project, using public repositories: `kubernetes/enhancements` (each proposal has a structured `kep.yaml`: owning SIG, stages by release, feature gates, replaces and superseded-by), `kubernetes/website` (English docs and blog as Markdown), and the release changelogs and deprecation guide.
- **Graph model:**
  - `(:KEP)-[:INTRODUCES]->(:FeatureGate)`, `(:KEP)-[:OWNED_BY]->(:SIG)`, `(:KEP)-[:SUPERSEDES]->(:KEP)`
  - `(:Release)-[:CHANGES {to:'beta'|'GA'|'deprecated'|'removed'}]->(:FeatureGate|:APIVersion|:Flag)`
  - `(:Page)-[:MENTIONS]->(:FeatureGate|:APIVersion|:Flag)` (found deterministically with regexes and the known name lists), `(:Page)-[:LINKS_TO]->(:Page)`, `(:Page)-[:OWNED_BY]->(:SIG)` (from the website's OWNERS files)
  - `(:Claim {text, as_of_release})-[:IN]->(:Page)` and `(:Claim)-[:DEPENDS_ON]->(:FeatureGate|:APIVersion)`: Claude extracts claims such as "this feature is in beta" only from paragraphs that mention a changed entity, so extraction stays small.
- **What it does:**
  - **Staleness propagation:** given a release, it marks each changed entity, then every claim and page that depends on it, then (with lower confidence) pages whose instructions link into a stale page. Each flag stores its justification path.
  - **Prioritised fix list:** stale pages ranked by PageRank on the docs link graph (a proxy for how much readers rely on them), grouped by owning SIG, so each team gets its own list.
  - **"Is this still true?":** a reader asks about a page or paragraph; the agent answers "as of release X" and shows the path to the evidence.
  - **Drafted fixes:** for the top items, Claude drafts the suggested edit with the source cited. Nothing is posted automatically.
  - **3 MCP tools:** `stale_pages(release, sig?)`, `why_stale(page)`, `is_current(page, claim?)`.
- **Validation:** for the most recent release, the top 30 flagged pages are checked by hand and the precision is reported in the README; any page that is truly stale may be reported upstream as an issue, which is real outside proof.
- **Claude API use:** claim extraction on a few hundred paragraphs plus drafts and answers; estimated well under $30.
- **Planned 2-minute demo:** pick the latest Kubernetes release; the canvas lights up the removed and graduated features, the claims that depend on them, then the pages, ripple by ripple; open the top page, see its highlighted outdated sentence and the path to the changelog line; switch to one SIG's fix list; show a hand-check score.
- **Out of scope:** non-English docs, other projects, auto-filing PRs, code-level drift.
- **Intended tracks:** Company Brain (main), Agents That Act on Connected Data.
