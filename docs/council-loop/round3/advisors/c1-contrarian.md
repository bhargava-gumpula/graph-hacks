# Contrarian review: candidate 1, the pre-install "publisher exposure" guard

## SCORES (1–10)
- **Graph essential: 5.** The core query is "find the distinct accounts reachable through a transitive closure," and an existing CLI already answers it with a plain recursive walk and no database ([dependency-maintainers](https://awesome.ecosyste.ms/projects/github.com%2Fnullvoxpopuli%2Fdependency-maintainers)). Only the worm replay and PageRank really need a graph, and those are the decorative parts.
- **Demo memorability: 5.** The brief's headline example falls apart on real data. `moment`, `dayjs` and `date-fns` all have zero runtime dependencies (this comes from my own knowledge of these packages, not a search), so the hook would show "1 vs 1 vs 1 new publisher." Getting a "1 vs 40" split means hunting for a contrived pair. The worm replay looks good but is labelled as a worst-case model, not a measurement.
- **4-day feasibility: 6.** Crawling 8–15k packuments is doable. The risk is the Cypher: a variable-length `Project-[:USES|DEPENDS_ON*]->()<-[:CAN_PUBLISH]-(a)` pattern enumerates *paths*, not nodes, and npm's dense DAG can blow up path counts. "Shortest path per account" for hundreds of accounts adds more cost.
- **Originality: 5.** The core finding dates from 2019 ([USENIX paper](https://www.usenix.org/conference/usenixsecurity19/presentation/zimmerman)). Socket already ships an MCP tool for coding agents that scores supply-chain risk before install ([Socket MCP](https://docs.socket.dev/docs/guide-to-socket-mcp)). The new part is the "new publishers added" set difference, which is narrow.
- **Real-world usefulness: 4.** Counting maintainers is a weak proxy for risk. It ignores 2FA, trusted publishing and the fact that npm revoked classic tokens after the 2025 attacks ([GitHub changelog](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/), [npm security plan](https://github.blog/2025-12-15-our-plan-for-a-more-secure-npm-supply-chain/)). The brief admits it models no barriers. Teams that care about this already pay for Socket or Snyk.

## WIN CHANCE (Agents That Act on Connected Data): ~5%
It fits the track well: an MCP tool, multi-hop paths and explainable output. The security-triage framing is also an example the organisers themselves list. Even so, among 100–300 real entries judged by FalkorDB staff, a project whose main query a judge can see reproduced by a 50-line script loses to entries where the graph obviously cannot be removed. Good execution puts it in the top 20, but it is unlikely to take the single prize.

## EVIDENCE
- Shai-Hulud is real and fits the pitch. Wave 1 hit 187+ packages ([Flashpoint](https://flashpoint.io/blog/shai-hulud-worm-targeting-npm-supply-chains/)) and wave 2 hit 600–800 packages and 25k+ repos ([Invicti](https://www.invicti.com/blog/web-security/shai-hulud-2-worm-supply-chain-attack-on-npm-dependencies)). The hook is timely.
- The 2019 paper found 79 packages and 39 maintainers trusted per install, and that fewer than 100 accounts reach half of npm ([acolyer summary](https://blog.acolyer.org/2019/09/30/small-world-with-high-risks/)). The "insight" is seven years old.
- `dependency-maintainers` already reports 333 distinct maintainers across 462 packages with `npx`, and needs no graph DB ([link](https://awesome.ecosyste.ms/projects/github.com%2Fnullvoxpopuli%2Fdependency-maintainers)).
- Socket MCP is hosted, free, needs no key and returns a supply-chain score per package to Claude or Cursor ([docs](https://docs.socket.dev/docs/guide-to-socket-mcp)).
- FalkorDB has `algo.pageRank`, `algo.SPpaths` and `algo.SSpaths` ([algorithms](https://docs.falkordb.com/algorithms), [procedures](https://docs.falkordb.com/cypher/procedures.html)). These confirm the claimed algorithms, but nothing makes a set difference across closures cheap. That has to be done in application code or with careful `collect(DISTINCT)`.
- npm publishes no firm rate limits, and clients should expect 429s ([npm blog](https://blog.npmjs.org/post/164799520460/api-rate-limiting-rolling-out)). A day-1 crawl is fine if it is throttled.
- I found no published past winners for WeMakeDevs/FalkorDB events. An earlier Graph Hacks ran an "Investigation and Risk" track ([rules](https://www.wemakedevs.org/hackathons/falkordb/rules)), which suggests the judges like risk and path stories.

## Simulation, briefly
- **Day 1:** the crawl works. The "latest version only" model diverges from `npm ls` wherever a range pins an older major, so the advertised match rate comes out at roughly 80–90% and invites questions.
- **Day 2:** the traversal on a real app (~800 transitive packages) times out or needs rewriting as BFS in Python. At that point FalkorDB is a store, not the engine.
- **Day 3:** canvas and replay. **Day 4:** the hunt for a demo pair that gives a dramatic number.

**A skeptical judge's 5 questions, each of which hurts:** (1) Why not just `npm owner ls` recursively? (2) How does this differ from Socket MCP? (3) Are maintainers with 2FA and trusted publishing really equal risk? (4) Lockfiles already pin, so when does this fire? (5) What does the graph do that a dict cannot?

## Steelman
It is timely, small in scope and honest about its limits. It gives an agent a concrete number at the moment it makes a decision, and "the agent changed its choice because of a graph path" is exactly the track's thesis.

## TOP 3 FLAWS
1. **The graph is replaceable.** A judge asks question 5, the builder admits a recursive fetch gives the same set, and the project fails the organisers' own decoration test.
2. **The metric is weak and the demo example is fake.** The date-library comparison comes out as a tie on real data. The agent "picks A" for a reason that does not exist, which hurts credibility in the video.
3. **It duplicates incumbents.** Socket MCP already sits in the same spot in the agent loop with richer signals, including malware detection, which this project explicitly leaves out of scope.

## THE BEST VERSION
- **Cut** shortest-path-per-account and the live canvas polish.
- **Keep** the hook and the set-difference tool.
- **Make the graph unavoidable:** model the account-to-package-to-dependent spread as the main product ("blast radius: if account X were phished today, which of *your* projects are hit, and by which path"), and precompute PageRank and choke points.
- **Pick demo candidates from real data** (e.g. `request` vs `axios`, or old `gulp` plugins vs modern ones) before writing the script.
- **Optionally add** Socket's score as one more edge property.

## VERDICT
Build it with changes: it is buildable and on-theme, but as briefed it measures a known, weak metric that a script can reproduce, so move the centre of gravity to graph-native blast-radius analysis and use honest demo numbers.
