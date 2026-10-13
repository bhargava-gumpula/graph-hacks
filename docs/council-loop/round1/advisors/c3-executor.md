# Executor review: Candidate 3, npm maintainer blast radius

## SCORES (1–10)
- **Graph essential: 8.** Reverse multi-hop reach, PageRank, betweenness and shortest paths over about 30k packages are the whole product. Without FalkorDB nothing is left except a list of maintainers.
- **Demo memorability: 8.** "Replay September 2025" is a real, famous incident with a climbing counter. Judges will remember it, as long as the animation runs on a pruned subgraph.
- **4-day feasibility for one builder: 5.** The brief promises a crawler, 4 algorithms, an animated canvas, lockfile analysis, 4 MCP tools, an agent and a deployment. Each piece is fine on its own. Together they leave no slack, and day 1 depends entirely on the crawl.
- **Originality vs competitors: 6.** The 2019 USENIX study already showed that a handful of npm accounts could reach most packages, and deps.dev has blogged about PageRank plus authorship for finding single points of failure. What is new here is the agent, the live replay and the lockfile view.
- **Real-world usefulness: 6.** AppSec teams and OpenSSF-style funders would use "which accounts can push into my lockfile" in practice. Socket, Snyk and Scorecard already cover parts of this, so it adds a view rather than creating a category.

## WIN CHANCE (Agents That Act on Connected Data): ~8%
The track lists security triage as an example, and this idea fits the track's wording closely. A topical incident plus visible Cypher should put it in the top 10–20 of an estimated 100–300 submissions. To win it has to beat polished agent demos. If the crawl or the canvas slips, it drops to an average entry.

## EVIDENCE
- Prior art: in [Zimmermann et al., USENIX Sec '19](https://usenix.org/conference/usenixsecurity19/presentation/zimmerman), a small number of maintainer accounts could reach most packages, and npm has single points of failure. The [deps.dev blog](https://blog.deps.dev/combining-dependencies-with-commits) uses PageRank plus shared authorship to surface single points of failure. [pkgrisk](https://docs.rs/crate/pkgrisk/0.1.0) and [bus-factor-js](https://github.com/garbados/bus-factor-js) flag single-maintainer packages, but neither offers a graph-wide reach view or an agent.
- The incident is real: on Sept 8, 2025, qix was phished through npmjs.help and 18 packages with about 2B+ weekly downloads were compromised ([Check Point](https://blog.checkpoint.com/crypto/the-great-npm-heist-september-2025/), [CodeAnt](https://www.codeant.ai/blogs/npm-chalk-debug-supply-chain-attack)). My searches did not confirm Shai-Hulud, so verify it before putting it on a slide.
- FalkorDB supports the plan: it has `algo.pageRank` and `algo.betweenness` ([PageRank docs](https://docs.falkordb.com/algorithms/pagerank), [betweenness](https://docs.falkordb.com/algorithms/betweenness-centrality.html)) and an official [MCP server](https://glama.ai/mcp/servers/FalkorDB/FalkorDB-MCPServer). Queries that run too long are aborted under `TIMEOUT_MAX`, and planner issues with variable-length traversals are still open ([config](https://docs.falkordb.com/getting-started/configuration), [codetriage](https://www.codetriage.com/falkordb/falkordb)).
- npm's [crawler policy](https://docs.npmjs.com/policies/crawlers) allows at most 1 request per second, with CouchDB replication recommended for bulk metadata. The downloads bulk endpoint takes at most 128 names and rejects scoped packages ([wrapper notes](https://apify.com/scrapyx/npm-packages-scraper.md)).
- I found no published winners from WeMakeDevs graph hackathons ([event pages](https://www.wemakedevs.org/hackathons/falkordb)).

## Simulation (where it breaks)
- **Day 1:** about 30k packuments at 1 request per second takes 8+ hours, before retries and 429 responses. Popular packuments can be several MB each, and the slim install format drops `maintainers`. There is also no API that returns a ranked "top 5,000 most-depended-on" list, so the seed list is itself a research task. *This is the first break.*
- **Day 2:** loading the graph is easy. Running `MATCH (m)-[:CAN_PUBLISH]->()<-[:DEPENDS_ON*]-(p)` across a dense DAG enumerates paths and will time out. Reach has to be precomputed with a BFS frontier loop. Betweenness on about 30k nodes and 150k edges should be computed once and stored as a property.
- **Day 3:** MCP tools, the agent, lockfile parsing and the canvas. The canvas cannot draw 30k nodes, so it needs a pruned replay tree.
- **Day 4:** tunnel, README, video. No buffer is left.
- **Demo:** shot 1 works if it is precomputed. Shot 2 works. Shot 3 is a live lockfile parse plus an agent call, and that is the shot most likely to stall on camera.
- **Judge questions:**
  1. "Summing dependents' downloads double-counts. What does 2B mean?"
  2. "The npm `maintainers` list is stale, and org teams and trusted publishing change who can actually publish."
  3. "Ranges are ignored, so is reach overstated?"
  4. "How is this different from the 2019 paper?"
  5. "What does the agent decide that a fixed dashboard couldn't?"

Questions 1, 2 and 5 have weak answers today.

**Steelman:** this idea has a real incident, a crisp question ("who is the next qix?"), graph algorithms doing the actual work, explainable paths and a clean fit with the track. **Attack:** day 1 rests on a fragile crawl, the reach metric is easy to poke holes in, the core finding was published in 2019, and the brief promises about 7 features in 4 days.

## TOP 3 FLAWS
1. **The crawl eats day 1.** Failure scenario: by Wednesday night 40% of packuments are missing because of 429s and multi-MB documents, and every later step runs on partial data.
2. **Unbounded reverse traversal explodes.** Failure scenario: the "maintainer reach" MCP tool times out live because Cypher enumerates paths instead of distinct nodes.
3. **The reach metric is shaky.** Failure scenario: a FalkorDB judge asks why reach shows "4.1B downloads" when npm's total is different, and the builder has no defensible definition.

## THE BEST VERSION
- **Cut:** the Advisory and Repo nodes, and the "removal that cuts the most exposure" optimization. Seed from a fixed top-2,000 list instead of 5,000.
- **Keep:** the replay, the top-10 single points of failure and the lockfile exposure.
- **Add:** a 1-hour crawl spike before coding starts so the throughput is known. Precompute reach and centrality into node properties so live queries only read them. Report reach as "number of dependent packages" with downloads as a secondary figure. Ship a static fallback video for shot 3.

## VERDICT
Build it with changes: shrink the crawl, precompute the heavy traversals and drop two features, because the demo idea is strong but the brief as written over-promises for one builder.
