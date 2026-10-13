# Contrarian review: candidate 3, an npm maintainer blast-radius agent

## SCORES (1–10)
- **Graph essential: 8.** Reverse variable-length traversal, PageRank and paths are the product. Remove FalkorDB and nothing is left, so it clearly passes the "decoration" test.
- **Demo memorability: 6.** "Replay Sept 2025" is a strong hook. But Qix's packages (chalk, debug, ansi-styles) sit near the leaves of the graph, so the animation hits most of the graph within one or two hops and the counter jumps straight to "nearly everything". That is a flash, not a story.
- **4-day feasibility for one builder: 5.** Promised: a crawler, four algorithms, an animated canvas, a lockfile parser, four MCP tools and a hosted deployment. That is too much to also crawl ~30k packuments plus download stats on day 1 from a registry with unpublished rate limits.
- **Originality vs competitors: 4.** A 2019 USENIX Security paper already measured "a few maintainer accounts can reach most of npm". deps.dev prototyped PageRank over authorship plus dependency edges to find single points of failure. Socket already shows maintainer counts on every npm page.
- **Real-world usefulness: 5.** Security teams would like the lockfile view. But "remove the one dependency" is rarely something you can act on (you cannot remove `debug`), and the maintainer data does not reliably show who can actually publish.

## WIN CHANCE (Agents That Act on Connected Data): ~7%
Among roughly 100–300 real entries this is in the top quartile for graph depth and timeliness, and security triage is an example the track itself names. Three things pull it down. Claude only narrates (the "acting" is a risk note). The headline finding is a known result from 2019. And there is one prize, against many polished agent demos.

## EVIDENCE
- Zimmermann et al. (USENIX Sec 2019) found that a small number of maintainer accounts could inject code into most packages, and that the average package implicitly trusts 39 maintainers: https://usenix.org/conference/usenixsecurity19/presentation/zimmerman, https://arxiv.org/pdf/1902.09217
- deps.dev added shared-authorship edges and ran PageRank, which "tends to highlight single points of failure". That is essentially this project's core: https://blog.deps.dev/combining-dependencies-with-commits
- Socket.dev lists maintainers per package and since Feb 2026 is linked from npm package pages: https://socket.dev/npm/package/bxjs, https://owasp.org/cve-lite-cli/docs/comparison/socket
- FalkorDB has `algo.pageRank(label, rel)` and `algo.betweenness({nodeLabels, relationshipTypes})`, so the claims hold: https://docs.falkordb.com/algorithms/pagerank, https://docs.falkordb.com/algorithms/betweenness-centrality.html
- The npm replication feeds changed in 2025, numeric rate limits are not published, and the docs say to expect 429s: https://github.blog/changelog/2025-02-27-changes-and-deprecation-notice-for-npm-replication-apis/, https://blog.npmjs.org/post/164799520460/api-rate-limiting-rolling-out
- Sources disagree on the Sept 2025 incident: 18, 20 or 25 packages. The 2FA reset was phished via npmjs.help: https://www.theregister.com/2025/09/08/dev_falls_for_phishing_email, https://endorlabs.com/learn/major-supply-chain-attack-compromises-popular-npm-packages-including-chalk-and-debug
- npm org teams get read-write access by default, so the packument `maintainers` list is not the full set of people who can publish: https://docs.npmjs.com/cli/v8/using-npm/orgs
- I found no published winners from WeMakeDevs' earlier FalkorDB hackathon. It had an "Investigation and Risk" track, so judges have seen risk-graph entries before: https://www.wemakedevs.org/hackathons/falkordb/schedule

## SIMULATION
**Build.** Day 1 is the crawler: 429s, scoped-package quirks, and the bulk downloads endpoint rejects scoped names, so the evening goes to data cleaning. Day 2 is graph load and Cypher. The naive `(p)<-[:DEPENDS_ON*]-(x)` enumerates paths, not nodes, and blows up on a dense graph, so it has to be rewritten as a precomputed BFS. Betweenness is O(V·E), roughly 30k × 150k, which is slow on a Mac. Day 3 is MCP, the canvas animation and the lockfile matcher, with many lockfile packages falling outside the crawled closure. Day 4 is deploy, video and README. There is no slack for any of it.

**Demo.** Shot 1 lands. Shot 2 ("next one") lists names that every security person already knows: sindresorhus, ljharb, isaacs. Shot 3 says "remove `debug`", which nobody can act on.

**Judge questions.**
1. "How is this different from the 2019 paper?" There is no good answer.
2. "Your download total sums dependents. Isn't that double-counting the same installs?" It is.
3. "Does `maintainers` capture org teams and tokens?" It doesn't.
4. "What does the agent *do*?" It writes a note.
5. "Reach is computed only inside your top-5k closure, isn't that circular?" Partly.

## STEELMAN
Timely, real incidents. Graph algorithms really are the core. Every answer comes with an explainable path. The lockfile input makes the demo personal. It fits a track example exactly.

## ATTACK
It is a re-run of known research with a weaker data source. The headline numbers inflate (summed downloads) and saturate (reach ≈ everything). The agent layer is thin.

## TOP 3 FLAWS
1. **Known result, obvious answers.** A judge with a security background recognises the "Small World" finding, and the top-10 list contains no surprises. Without a novel insight the project reads as a visualisation of a 2019 paper.
2. **Misleading metrics.** The "running download total" adds up downloads of packages that share the same installs, so it can show more than npm's real weekly volume. One sharp judge question exposes this, and credibility collapses. The maintainer data misses org and team publishers, so "single maintainer" will be wrong for some packages.
3. **Scope blow-up.** The crawler slips into day 2, and the variable-length reverse traversal and betweenness time out on the demo Mac. The lockfile feature ships half-working.

## THE BEST VERSION
- **Cut:** betweenness, the `Repo` and `Advisory` nodes, and the summed-download counter. Weight reach by *distinct dependent packages* plus the downloads of top-level roots only.
- **Keep:** precomputed maintainer reach (stored on the node), single points of failure, the replay and the lockfile exposure.
- **Add a new signal:** whether each high-reach package publishes with npm provenance or trusted publishing (public attestation data). That turns "who is a single point of failure" into "who is a single point of failure *and* still publishes with a plain password and token". That is new, and it is something people can act on.
- **Add an action:** the agent writes `overrides` and version pins, or a ready-to-file issue, for the lockfile.
- Cite the 2019 paper in the README and show what changed since then.

## VERDICT
Build it with changes: the graph core is real, but unless you drop the inflated metrics and add a new signal such as provenance, judges will see a 2019 paper turned into an animation.
