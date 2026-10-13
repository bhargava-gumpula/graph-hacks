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

## The idea: an outdated-docs finder for Kubernetes that proves why a page is wrong and routes it to the person who can fix it
Kubernetes removes and graduates features every release, and its docs fall behind. Some of this is automated already: pages that use the `feature-state` shortcode with `feature_gate_name` update their status badge on their own. This project targets what that automation misses (hand-written prose, manifests with removed API versions, and badges without `feature_gate_name`) and connects each finding to the tickets and people behind it.

- **"The company":** the Kubernetes project's public repositories: `kubernetes/website` (English docs, cloned with full git history), `kubernetes/enhancements` (structured `kep.yaml` per proposal: owning SIG, stages per release, feature gates, tracking issue), and the website's feature-gate reference files (stage per release, `removed` flag), which are the ground truth for what changed.
- **Graph model:**
  - Truth: `(:Release)-[:CHANGED {to:'beta'|'GA'|'deprecated'|'removed'}]->(:FeatureGate|:APIVersion)`, `(:KEP)-[:INTRODUCES]->(:FeatureGate)`, `(:KEP)-[:OWNED_BY]->(:SIG)`, `(:KEP)-[:TRACKED_IN]->(:Issue)`.
  - Docs: `(:Page)-[:HAS_CLAIM]->(:Claim {kind, text, line})-[:ABOUT]->(:FeatureGate|:APIVersion)`, where claims are deterministic: a `feature-state` shortcode without `feature_gate_name` (states a stage), a YAML manifest with an `apiVersion`, or a sentence mentioning a gate. `(:Page)-[:LINKS_TO]->(:Page)`.
  - Tickets and people: `(:Person)-[:AUTHORED|REVIEWED]->(:PR)-[:EDITED]->(:Page)` from git history and the GitHub API, `(:Issue)-[:REPORTS]->(:Page)` for existing "outdated docs" issues, and `(:Page)-[:OWNED_BY]->(:SIG)` from OWNERS files.
- **What it does:**
  - **Excludes what is already correct:** pages whose stage badges are auto-maintained, generated reference pages and blog posts are explicitly marked "auto-maintained / historical" and skipped.
  - **Finds contradictions:** a claim is stale when the truth layer says its gate or API version changed after the claim was written. Claude is used for one narrow job: classifying a gate-mentioning sentence as describing the current state or describing history ("went GA in 1.29" is history, not stale).
  - **Shows the proof path:** Page → Claim → FeatureGate → CHANGED in Release → KEP → tracking issue, as a plain-English card ("The docs say: beta. The truth: removed in v1.33, see KEP-1234").
  - **Routes the fix:** who should fix it is a graph answer: the SIG that owns the KEP, the people who recently edited the page, and whether an issue already reports it.
  - **Backtest:** run the finder as of an older release (using git history) and measure how many flagged pages were later fixed by real website PRs; this gives a recall number from real outcomes, not just a hand check.
  - **Agent guard (Track 1):** an MCP tool `is_current(snippet)` that a coding agent calls before trusting a doc snippet; demoed with Claude Code about to write a manifest with a removed `apiVersion` and correcting itself.
  - Linked pages are shown only as "at risk" context, not counted as findings.
- **Build order and cut line:** day 1: truth layer and claim extraction; day 2: exclusions, contradiction finding, grep baseline; day 3: people and ticket layer, proof cards; the backtest and the `is_current` agent guard are built only if the rest is done by the end of day 3.
- **Validation and outside proof:** a grep baseline (gate names against the removed list) is run next to the graph result, with precision reported per claim type on a hand-checked sample; 2–3 real issues or PRs are filed upstream during the event and linked in the README.
- **Claude API use:** a few hundred short classifications plus explanations; estimated under $15.
- **Planned 2-minute demo** (the numbers below are placeholders; the real ones come from the run): (1) "grep finds 60 pages, 25 of them false alarms; the graph keeps 31 real ones, with proof"; (2) open one plain-English card and its path; (3) one SIG's fix list with suggested owners and an already-open issue linked; (4) backtest: "as of v1.30, 18 of the pages we flagged were later fixed by real PRs"; (5) Claude Code calls `is_current` and swaps a removed `apiVersion`; (6) a link to an upstream issue we filed.
- **Out of scope:** non-English docs, other projects, auto-filing PRs, drafted rewrites beyond the few filed upstream.
- **Intended tracks:** Company Brain (main), Agents That Act on Connected Data.
