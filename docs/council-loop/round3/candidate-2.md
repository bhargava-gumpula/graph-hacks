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

## The idea: a Kubernetes "version truth" MCP server that stops coding agents from writing removed APIs, and shows which docs fixes matter most
Coding agents (and the people copying from docs) often write Kubernetes manifests with API versions or feature gates that were removed several releases ago, because their training data and many web pages are stale. This project builds a graph of what changed in each Kubernetes release, linked to the docs and example files that depend on it, and exposes it as MCP tools a coding agent calls before it trusts a manifest, with the reason traced back to the enhancement proposal (KEP).

- **"The company":** the Kubernetes project's public repositories: `kubernetes/website` (English docs plus the `content/en/examples/` manifest files that pages include through the `code_sample` shortcode, and its git history), `kubernetes/enhancements` (`kep.yaml` per proposal: owning SIG, stages per release, feature gates), the website's feature-gate reference files (stages per release, a `removed` flag), and the official deprecated-API migration guide (API version → removed in release → replacement).
- **Graph model:**
  - Truth: `(:Release)-[:CHANGED {to}]->(:FeatureGate|:APIVersion)`, `(:APIVersion)-[:SERVES]->(:Kind)`, `(:APIVersion)-[:REPLACED_BY]->(:APIVersion)`, `(:KEP)-[:INTRODUCES]->(:FeatureGate)`, `(:KEP)-[:OWNED_BY]->(:SIG)`.
  - Docs: `(:Page)-[:INCLUDES]->(:Example)-[:USES]->(:APIVersion|:Kind)`, `(:Page)-[:HAS_CLAIM]->(:Claim)-[:ABOUT]->(:FeatureGate|:APIVersion)` (claims found deterministically: `feature-state` badges without `feature_gate_name`, inline YAML, sentences naming a gate), `(:Page)-[:LINKS_TO]->(:Page)`.
  - People: `(:Person)-[:EDITED {at}]->(:Page|:Example)` from local `git log` only, `(:Page)-[:OWNED_BY]->(:SIG)` from OWNERS files.
- **What it does (core, by the end of day 2):**
  - **`is_current(snippet, target_version)`:** parses a manifest or command a coding agent is about to use, follows APIVersion/Kind/FeatureGate to the truth layer, and returns "removed in v1.X, use Y instead", with the path to the KEP or migration-guide entry.
  - **`explain_change(name)`:** the provenance path for one gate or API version (release → KEP → owning SIG), so the agent can cite its source when it corrects itself.
  - A Claude Code hook calls `is_current` whenever the agent writes a `.yaml` file containing `apiVersion:`.
- **What it does (day 3):**
  - **Stale-docs impact ranking:** when a gate or API version is removed, propagate to the example files that use it, then to every page that includes those examples or carries a stale claim. Fixes are ranked by impact: one shared example file can be included by many pages, so fixing it repairs all of them. Rank also considers PageRank on the docs link graph (a proxy for reader traffic). This is the part a lookup table can't do: the answer is a traversal over include and link edges.
  - **Routing:** for each top fix, the owning SIG (via the KEP) and the people who most recently edited that file, ranked by recency over the EDITED edges.
  - Claude is used only to classify a gate-mentioning sentence as describing the current state or describing history ("went GA in 1.29" is history, not stale).
- **Honest measurement:** in the first 3 hours of day 1 the builder counts the real stale findings. If there are fewer than 15, the pitch leads with the agent guard and the docs ranking becomes a secondary view. A grep baseline is shown next to the graph result. 1–2 real upstream issues are filed on day 2.
- **Cut:** the GitHub API crawl, the existing-issue layer, the full historical backtest (replaced by 3 hand-picked past docs fixes the tool would have caught), and drafted rewrites.
- **Claude API use:** a few hundred short classifications plus explanations; estimated under $15.
- **Planned 2-minute demo** (numbers are placeholders): (1) a 10-second hook: a user's deploy failing because a tutorial manifest used a removed API version; (2) Claude Code is asked to write a CronJob/HPA/Ingress for a v1.3x cluster, the hook fires, `is_current` flags the removed `apiVersion`, and the agent corrects itself, citing the KEP path; (3) "which docs fixes matter most": the canvas shows one example file included by many pages lighting up, ranked against the grep list; (4) the routing card shows the SIG and recent editors; (5) a link to the upstream issue filed.
- **Out of scope:** non-English docs, CRDs and third-party APIs, live cluster access, auto-filing PRs.
- **Intended tracks:** Agents That Act on Connected Data (main), Company Brain.
