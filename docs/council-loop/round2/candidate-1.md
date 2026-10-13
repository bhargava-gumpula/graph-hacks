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

## The idea: a supply-chain agent that tells a project which npm dependency paths a stolen publish token could use, and changes the lockfile to close them
In September 2025 one npm maintainer's account was phished and malicious versions of chalk, debug and 16 other packages were published. Days later the self-spreading "Shai-Hulud" worm stole npm tokens from developers who installed infected packages and used them to publish infected versions of those developers' own packages, reaching hundreds of packages. Research since 2019 ("Small World with High Risks", USENIX Security) has shown that a few accounts can reach much of npm. This project takes that known result and makes it actionable for one project, and adds what that study lacked: worm-style propagation, publish provenance, and pinned vs floating version ranges.

- **Scope (stated honestly):** the runtime dependency closure of a fixed seed list of the 2,000 most-depended-on npm packages (estimated 8,000–15,000 packages), latest versions only, collected once on day 1 from the public npm registry and cached; the README states the snapshot date and that latest-version data approximates, rather than reproduces, past incidents.
- **Graph model:**
  - `(:Package {name, weekly_downloads, provenance:bool})-[:DEPENDS_ON {range, floating:bool}]->(:Package)`. `floating` is true when the range accepts new patch or minor releases (`^`, `~`, `*`), false when it is pinned. A pinned edge stops propagation, because a new malicious release is not picked up automatically.
  - `(:Account {id_hash})-[:CAN_PUBLISH]->(:Package)`. Accounts are shown as anonymous IDs: the product ranks packages and paths, never people.
  - `provenance` comes from the registry's public attestation data (whether the latest version was published through trusted publishing / provenance). Such a package cannot simply be republished with a stolen token, so the model treats it as a barrier.
  - Precomputed properties written back to nodes: `reach` (distinct packages that can auto-update into this one through floating edges) and `pagerank`.
- **What it does:**
  1. **Lockfile exposure (the main feature):** given a public project's `package-lock.json`, it finds every account that can push code into that project through floating, non-provenance paths, and the shortest such path for each, using Cypher variable-length traversal over the precomputed subgraph.
  2. **Action, not just a report:** the agent picks the smallest set of edits that cut the most exposure (pin these 3 transitive packages via `overrides`, set pnpm's `minimumReleaseAge`/npm-equivalent delay), recomputes exposure live in the graph to show the drop, and drafts the change as a PR description. Nothing is pushed automatically.
  3. **Worm mode:** a round-by-round contagion over the graph: an infected package → projects that depend on it through floating edges → their publishing accounts' tokens are assumed stolen → those accounts' other packages are infected, unless they have provenance. It is an upper-bound model with one stated assumption (anyone who installs within the window is compromised).
  4. **Validation against reality:** the worm model is seeded with the first publicly reported Shai-Hulud package, and its predicted set is compared with the public list of compromised packages published by security vendors. The overlap (precision and recall) is reported in the README, whatever it turns out to be.
  5. **"Harden these 10":** a greedy pass over the top 100 PageRank packages picks the 10 whose adoption of trusted publishing would most shrink worm reach; computed offline, stored in the graph, shown as a before/after.
- **Build order and cut line:** day 1: crawl and graph load; day 2: features 1–2; day 3: feature 3 and the canvas; features 4 and 5 are built only if 1–3 are done by the end of day 3, otherwise they are cut.
- **Metrics:** reach is reported as a count of distinct packages and distinct projects, never summed downloads (which double-count installs).
- **Agent + MCP:** 4 typed tools (`lockfile_exposure`, `cut_exposure`, `worm_replay`, `why_path`) that Claude chooses between; each shows its Cypher. Claude writes the explanation and the PR text only, so API spend stays low.
- **Planned 2-minute demo** (the numbers below are placeholders; the real ones come from the run): (1) paste the lockfile of a well-known open-source app: "47 accounts can ship code into this app; here are the 3 shortest paths"; (2) the agent proposes 3 pins plus a release-age delay, and the number drops to 9 live; (3) worm mode replays Shai-Hulud round by round on the canvas, then shows the overlap with the real compromised list; (4) toggling "trusted publishing on these 10 packages" stops the worm at round 2.
- **Out of scope:** other ecosystems, historical version resolution, detecting malicious code, naming or contacting individuals.
- **Intended tracks:** Agents That Act on Connected Data (main).
