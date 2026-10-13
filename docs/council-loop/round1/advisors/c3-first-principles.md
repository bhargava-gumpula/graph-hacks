# First Principles advisor: Candidate 3 (npm maintainer blast-radius agent)

**The underlying problem, stripped down:** one stolen publish credential becomes code running in millions of builds, because trust passes silently through transitive dependencies. Two questions follow. (a) Who holds the keys to the most of that trust? (b) Is my project reachable from them? Both are reachability questions over a directed graph, so a graph is the right data structure here. It is not decoration. The weaker question is whether *an agent* is the right interface. The core outputs (reach per maintainer, PageRank, single points of failure) are batch computations that one script could print as a ranked table. Claude adds explanation, not capability.

## SCORES (1–10)
- **Graph essential: 8.** Reverse variable-length traversal from Maintainer through CAN_PUBLISH and DEPENDS_ON is the product. Take FalkorDB out and nothing works. It is not a 9: NetworkX would do the same job offline.
- **Demo memorability: 7.** "Replay September 2025" with a climbing download counter, based on a real incident that cost about 2B weekly downloads, is a strong opening shot. The lockfile segment is weaker.
- **4-day feasibility: 5.** The crawl (20–40k packuments, downloads in bulk batches of at most 128 names, scoped packages fetched one at a time, 429 handling) eats day 1. Betweenness on about 40k nodes and about 150k edges is fine, but six features plus an animated canvas is a lot for one builder.
- **Originality: 4.** Zimmermann et al. (USENIX Sec '19) ran exactly this analysis: maintainer reach and single points of failure on npm. anvaka/npmrank already does PageRank and per-author dependent counts. Neo4j has published a deps.dev dependency-graph walkthrough. What is new is the agent, MCP and lockfile wrapper, not the insight.
- **Real-world usefulness: 5.** Security teams care, but what they can do with the answer is thin. You cannot fire sindresorhus or Qix. "Remove one dependency" is rarely a real option for a deep transitive package. The actual fixes (2FA, trusted publishing, delaying installs of new versions) don't depend on the ranking. The registry `maintainers` list is also only a proxy for who can really publish.

## WIN CHANCE (Agents That Act on Connected Data): ~8%
The idea fits the track's own examples (security triage, graph algorithms as tools, explainable paths). It uses real public data and a real headline incident. Against that, 100–300 submissions will include many security-graph entries. Judges who know the Zimmermann paper will see a re-run of 2019 research. About 2–3x the base rate.

## EVIDENCE
- The Sept 8 2025 incident: Qix phished through a fake npmjs.help 2FA reset, 18 packages, 2–2.6B weekly downloads, reverted in about 2h ([Upwind](https://www.upwind.io/?p=11695), [CodeAnt](https://www.codeant.ai/blogs/npm-chalk-debug-supply-chain-attack), [Cybersierra](https://www.cybersierra.co/blog/npm-chalk-debug-compromised)).
- Prior art on the core finding: "a small number of maintainer accounts could inject malicious code into most npm packages" ([arXiv 1902.09217](https://arxiv.org/pdf/1902.09217), [Morning Paper](https://blog.acolyer.org/2019/09/30/small-world-with-high-risks/)).
- PageRank, HITS and author-reach counts on npm already exist ([anvaka/npmrank](https://github.com/anvaka/npmrank)). There is a Neo4j deps.dev graph tutorial ([Neo4j blog](https://neo4j.com/blog/developer/analyzing-software-dependencies-depsdev/)).
- FalkorDB has `algo.pageRank(label, relType)` and `algo.betweenness(config)` ([procedures](https://docs.falkordb.com/cypher/procedures.html), [algorithms](https://docs.falkordb.com/algorithms)). Confirmed.
- npm downloads API: bulk queries are capped at 128 packages, scoped packages are not allowed in bulk, and the API can return 429 without warning ([npm blog](https://blog.npmjs.org/post/164799520460/api-rate-limiting-rolling-out), [Apify notes](https://apify.com/scrapyx/npm-packages-scraper.md)).
- Socket and Snyk score single-maintainer and behaviour risk, but neither offers a public maintainer blast-radius graph ([pkgpulse](https://www.pkgpulse.com/guides/npm-security-landscape-supply-chain-attacks-2026)).
- Trusted publishing and provenance don't stop a hijacked session ([nodeland](https://adventures.nodeland.dev/archive/why-trusted-publishing-can-t-save-us/)). This supports the problem but weakens "who" as the fix.

## Simulation (brief)
- **Day 1:** the crawler is the risk. Expect retries and missing download counts.
- **Day 2:** loading the data and running Cypher reach queries. A per-maintainer transitive closure over 40k nodes has to be precomputed, not run live.
- **Day 3:** MCP tools, agent, lockfile parsing.
- **Day 4:** canvas animation, deployment, video.
- **Demo:** shot 1 lands. Shot 2 shows famous names everyone already knows. Shot 3 recommends removing a dependency that nobody can actually remove.
- **Judge questions:** "How is this different from the 2019 paper?" "Does the maintainers field equal publish rights?" "Why does it need an agent?" "What should I *do* with the list?" "Isn't this a static snapshot?" The current brief has no good answer to the first and fourth.

## Steelman / Attack
**For:** real data, a real incident, real multi-hop graph work, explainable paths, MCP tools that fit the track word for word.
**Against:** the insight is seven years old. The agent is a wrapper around a ranked table. The recommendations aren't actionable. The brief over-promises six features in four days.

## TOP 3 FLAWS
1. **The idea is a re-run of 2019 research.** A judge asks "what's new?", and the honest answer is "an LLM wrapper". The score drops.
2. **The output can't be acted on.** "Remove `debug` to cut 40% of exposure" is not something a user can do, and a skeptical judge says so on camera.
3. **The day-1 crawl stalls.** npm sends 429s, scoped packages need one request each, and download totals arrive late. With no clean graph by day 2, the animation and the lockfile feature both slip.

## THE BEST VERSION
- **Cut:** betweenness and the Advisory and Repo nodes.
- **Keep:** maintainer reach, attack replay, lockfile exposure.
- **Add:** a time dimension. A `PUBLISHED {at}` edge, plus a "freshness gate" the agent can recommend: "pin these 6 paths, or set a minimum release age, and September 2025 would have missed you". The output becomes something the user does, not a fact to read. Lead with the lockfile result for a real public app, not the global top-10 list.

## VERDICT
Build it with changes: keep the replay and the lockfile exposure, drop the extras, and turn the graph's answers into actions a user can take, so it isn't a re-run of the 2019 paper.
