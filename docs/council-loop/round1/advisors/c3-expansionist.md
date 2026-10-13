# Candidate 3 — Expansionist advisor (npm maintainer blast radius)

## SCORES (1–10)
- **Graph essential: 9** — Variable-length reverse traversal, PageRank and betweenness over 20–40k packages *are* the product. Take FalkorDB out and nothing is left.
- **Demo memorability: 8** — "Replay September 2025" with a download counter climbing to ~2B/week is about as strong an opener as a hackathon gets. It's a real, recent event judges will remember.
- **4-day feasibility for one builder: 6** — The crawl, the load and the algorithms are routine. The risks are packument size and crawl time, scoped packages needing separate download calls, and the cost of computing reach for every maintainer.
- **Originality vs competitors: 6** — The core finding was published in 2019 (USENIX). Socket and Snyk flag single packages. Nobody ships an agent that answers "who can push code into my lockfile, and by which path."
- **Real-world usefulness: 7** — AppSec teams and OSS foundations (e.g. OpenSSF) have a real and current need, and the lockfile feature is something people would run on Monday morning.

## WIN CHANCE (Agents That Act on Connected Data): ~10%
The track examples literally say "security triage". This idea fits the track text closely and makes heavy use of algorithms, which few entries will. I expect most of the 100–300 submissions to be GraphRAG chatbots. The ceiling is capped by the lack of a rubric, by the iPhone track likely being the most crowded, and by the agent layer being thin (4 tools) compared with the graph work.

## EVIDENCE
- The Sept 8, 2025 phishing of maintainer "qix" hit 18 packages with about 2–2.6B weekly downloads. The malicious versions were live for about 2 hours. Sources: [Check Point](https://blog.checkpoint.com/crypto/the-great-npm-heist-september-2025/), [Security Boulevard](https://securityboulevard.com/2025/09/how-one-phishing-email-compromised-18-npm-packages-and-billions-of-installs), [CodeAnt](https://www.codeant.ai/blogs/npm-chalk-debug-supply-chain-attack).
- Prior art: Zimmermann et al. found that a small number of maintainer accounts could inject code into most of npm ([USENIX Sec '19](https://usenix.org/conference/usenixsecurity19/presentation/zimmerman), [arXiv](https://arxiv.org/pdf/1902.09217)). That was a static study, not a tool. Existing tools such as [pkgrisk](https://docs.rs/crate/pkgrisk/0.1.0) give a bus factor per package, with no transitive maintainer reach. [Socket](https://appsecsanta.com/sca-tools/sca-tools-for-nodejs) watches for maintainer changes but answers "is this package bad", not "whose account owns my tree".
- FalkorDB has `algo.pageRank(label, rel)` and `algo.betweenness({nodeLabels, relationshipTypes, samplingSize})`. The sampling option makes betweenness tractable at 30k nodes ([PageRank](https://docs.falkordb.com/algorithms/pagerank), [betweenness](https://docs.falkordb.com/algorithms/betweenness-centrality.md)). An official [FalkorDB MCP server](https://glama.ai/mcp/servers/FalkorDB/FalkorDB-MCPServer) exists, but custom typed tools are the better choice here.
- The npm bulk downloads endpoint takes at most 128 packages per call and no scoped packages ([npm blog](https://blog.npmjs.org/post/164799520460/api-rate-limiting-rolling-out)). The registry search endpoint returns a `dependents` count ([Apify docs](https://apify.com/s-r/npm-scraper.md)). deps.dev provides graph data ([Neo4j write-up](https://neo4j.com/blog/developer/analyzing-software-dependencies-depsdev/)).
- I found no published list of WeMakeDevs winners ([archive](https://archive.wemakedevs.org/), [Telegram](https://t.me/s/WeMakeDevs)), so I can't benchmark against past winners.

## SIMULATION
Day 1: build the crawler (packuments are large, so fetch the abbreviated metadata, which still includes `maintainers`) and load into FalkorDB. Day 2: PageRank, betweenness, reach queries, and precomputing per-maintainer reach. This breaks if reach is run live for 10k maintainers; it must be batched and cached. Day 3: MCP tools, the agent, and the lockfile parser. Day 4: the replay animation, deployment and the video. The demo works shot for shot.

Judge questions:
1. "Isn't this the 2019 paper?" You need a "what's new" answer: live data, the lockfile view, an agent.
2. "Latest-only versions overstate reach?" Yes, partly.
3. "Can a maintainer actually publish without 2FA or provenance?" The model doesn't know.
4. "What action does the agent take?" Weak today.
5. "How fresh is the data?" A snapshot.

## STEELMAN / ATTACK
**For:** Timely and visceral. Graph-native, with real algorithms. It fits the track wording ("security triage, explainable paths") and has a clear user. It's also a strong blog-post prize angle.

**Against:** The headline insight is seven years old. The "agent" part is thin and could be judged a dashboard with a chat box. And the reach numbers are dramatic by construction, since almost everything depends on debug.

## TOP 3 FLAWS
1. **Known result.** A FalkorDB judge who knows the supply-chain literature reads "top accounts reach most of npm" as a replication. If the demo stops at shot 2, it scores as a nice visualization.
2. **Reach inflation.** Latest-version-only data and ignoring semver ranges mean the replay could show far more than the real ~2-hour impact. Someone on the judge panel asks "how many were really affected?" and there's no answer.
3. **Precompute and scale trap.** Unbounded `<-[:DEPENDS_ON*]-` from debug touches most of the graph. Live queries time out on the tunnelled Mac during judging.

## THE BEST VERSION
- **Keep:** the replay, single points of failure, the lockfile exposure view, and Cypher shown next to every answer.
- **Cut:** betweenness, unless it earns a specific demo moment. Also cut Repo nodes and most of the advisory data.
- **Add the upside:**
  1. **A Shai-Hulud worm mode.** Contagion over maintainer → package → dependents' maintainers, showing the self-spreading worm as graph propagation, not just one account. Only a graph can show this.
  2. **"Harden these 10 accounts."** The agent picks the smallest set of maintainers whose phishing-resistant 2FA would cut the most exposure. The bar drops live, which turns analysis into an action.
  3. **A CI output.** The lockfile check emits a PR comment or badge, answering "who uses this?" concretely.
  4. **Reach scoped by semver,** so the replay is defensible.

These are reachable if the crawl is finished by end of day 1. Submit the blog post for the AirPods side prize.

## VERDICT
Build it with changes: keep the September replay as the hook, but make the worm-propagation and "harden these accounts" actions the novel core, so judges see an agent acting on the graph and not a re-run of a 2019 study.
