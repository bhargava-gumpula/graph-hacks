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

## The idea: a pre-install guard that coding agents call before they add an npm dependency
AI coding agents add npm dependencies all the time, and each new package brings its whole transitive tree. In 2025, phished maintainer accounts and the self-spreading "Shai-Hulud" worm showed that the real risk is *who can publish* anywhere in that tree. This project is an MCP server backed by FalkorDB that answers one question for an agent before it runs `npm install X`: "how many more publishing accounts could ship code into this project if I add X, through which paths, and is there a smaller alternative?"

- **What is and isn't claimed (stated up front):**
  - A committed lockfile pins exact versions. The exposure measured here is therefore what a *fresh resolution* pulls in: adding a new dependency, `npm update`, a Dependabot bump, or a library being installed by its users. The README says so in the first paragraph.
  - Publish controls (2FA, trusted publishing, token restrictions) are mostly not visible in public metadata, so the tool models no barriers. Every account listed as a maintainer counts as able to publish, and the README states this limitation.
  - The core finding that a few accounts reach much of npm is known research ("Small World with High Risks", USENIX Security 2019) and is cited. What's new is putting it in an agent's decision loop at the moment a dependency is chosen.
- **Graph model:**
  - `(:Package {name, weekly_downloads})-[:DEPENDS_ON {range}]->(:Package)`: latest version, runtime dependencies.
  - `(:Account {id_hash})-[:CAN_PUBLISH]->(:Package)`: accounts are anonymised; the product ranks packages and paths, never people.
  - `(:Project)-[:USES]->(:Package)` for the project being worked on, built from its `package.json`.
- **Data:** the dependency closure of the 2,000 most-depended-on npm packages (estimated 8,000–15,000 packages), crawled from the public npm registry on day 1 and cached. Any package an agent asks about that isn't in the graph is fetched on demand (its packument and its missing dependencies) and added.
- **What it does (3 features, nothing else):**
  1. **`exposure(project)`:** the set of distinct accounts that can publish any package in the project's transitive closure, with a shortest path for each, as a Cypher variable-length traversal from Project to Account.
  2. **`compare_install(project, candidates[])` (the agent tool):** for each candidate package, the *new* accounts and packages it would add (a set difference over two traversals) and the paths that introduce them. An agent asked to "add a date library" compares e.g. `moment`, `dayjs` and `date-fns` and sees which adds the fewest new publishers. A Claude Code `PreToolUse` hook on `npm install` calls this automatically and returns the comparison to the agent, which decides; nothing is blocked.
  3. **Worm replay (an illustration, not a validation):** starting from one package, a round-by-round spread through the graph (infected package → packages that depend on it → their publishing accounts → those accounts' other packages), with the current project highlighted at the round it would be reached. It is labelled as a worst-case model.
- **Graph algorithms used:** variable-length traversal and set difference for features 1–2; PageRank over DEPENDS_ON to label the "load-bearing" packages that show up on most paths. Results are precomputed where possible, and live queries are bounded to the project's subgraph.
- **Checking it's right:** 10 projects' transitive closures are checked against `npm ls --all` on a fresh install; the match rate goes in the README.
- **Claude API use:** only to word the agent's explanation. The comparison itself is Cypher. Well under $30.
- **Planned 2-minute demo** (numbers are placeholders; the real ones come from the run): (1) "Shai-Hulud hit hundreds of packages; here's how close it could get to your app." (2) Claude Code is asked to add a date library; the hook fires, the canvas shows that candidate A adds 1 new publisher and candidate B adds 40 through 3 paths, and the agent picks A and explains why. (3) The worm replay reaches the project at round 3 with B, and never with A. (4) The Cypher behind each step is shown.
- **Build order:** day 1 crawl and load; day 2 features 1–2 and the hook; day 3 canvas and worm replay; day 4 checks, deployment, video. If day 1 slips, the seed list shrinks to 1,000.
- **Out of scope:** other ecosystems, version history, malicious-code detection, blocking installs, naming individuals.
- **Intended tracks:** Agents That Act on Connected Data (main).
