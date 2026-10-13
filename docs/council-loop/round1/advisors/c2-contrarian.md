# Contrarian review: candidate 2, the "real expert" issue-triage agent

## SCORES (1–10)
- **Graph essential: 6.** Traversing issue → PR → file → component → person is a real multi-hop path. But the two signature algorithms don't fit FalkorDB well. As far as the docs show, `algo.pageRank` takes only a node label and a relationship type, and `algo.labelPropagation` takes `nodeLabels`/`relationshipTypes`. Neither documents edge weights. So "recency-weighted PageRank within a component" and weighted co-change clustering will probably end up in Python/networkx, and then the graph is decoration for the very features the pitch leads with.
- **Demo memorability: 6.** The greyed-out owner with "no activity in 14 months" and the live correction are good beats. A path animation with Cypher shown is what every Graph Hacks entry will do.
- **4-day feasibility: 5.** The brief packs in ingestion, two derived graphs, community detection, PageRank, local embeddings, bitemporal corrections, 3 MCP tools, a canvas UI, a 20-issue evaluation and a tunnel deployment. That is 10+ subsystems for one person. Each one is doable, but all of them working together is not.
- **Originality vs competitors: 4.** CodeScene already sells knowledge distribution, bus factor and off-boarding simulation. Open-source checkOwners infers CODEOWNERS with bus factor and expertise decay. Reviewer recommendation (RevFinder, cHRev, CORRECT) has been studied for a decade. The sponsor's own Code-Graph already indexes repos, including git history, into FalkorDB.
- **Real-world usefulness: 5.** It's useful inside large companies, which is why CodeScene charges for it. For the chosen public repos it isn't: vite's maintainers already know who owns what, and outsiders don't route issues.

## WIN CHANCE (Company Brain): ~6%
With 100–300 real submissions, a solid, well-shipped entry might reach the top 10–15%. "Who owns and knows what" matches the track text closely, which helps. But "GitHub repo as company brain" is the obvious idea: expect several near-duplicates, and the sponsor's own Code-Graph sets a high bar for "repo in a graph". The data is only PRs, issues and CODEOWNERS (no docs, chats or decisions), so it covers just one bullet of the track. The secondary track adds maybe 2 points.

## EVIDENCE
- FalkorDB algorithms use `CALL algo.<name>()`. PageRank works "over nodes of given label, considering only edges of given relationship type", and the CDLP config lists `nodeLabels` and (on the new docs) `relationshipTypes`. Neither documents weights: [algorithms](https://docs.falkordb.com/algorithms), [procedures](https://docs.falkordb.com/cypher/procedures.html), [cdlp](https://docs.falkordb.com/algorithms/cdlp.md). The docs host didn't resolve when I tried to fetch it, so this comes from search snippets.
- Prior art: [checkOwners](https://dev.to/smusali/meet-checkowners-confidence-scored-codeowners-from-your-git-history-4280), [Bus Factor Explorer](https://www.themoonlight.io/en/review/bus-factor-explorer), [CodeScene knowledge distribution](https://docs.enterprise.codescene.io/versions/4.2.3/guides/social/knowledge-distribution.html) and [off-boarding simulation](https://codescene.com/resources/use-cases/improve-knowledge-sharing), [CORRECT reviewer recommender](https://arxiv.org/abs/1807.04130v1), [IR + social-network recommender (74% top-1)](https://www.trustie.net/attachments/download/84261/Reviewer%20Recommender%20of%20Pull-Requests%20in%20GitHub.pdf), [reviewer-recommender OSS](https://science.ecosyste.ms/api/v1/projects/7474).
- Sponsor overlap: [FalkorDB Code-Graph](https://docs.falkordb.com/genai-tools/code-graph.md), [blog](https://www.falkordb.com/blog/code-graph-is-the-secret/).
- GitHub GraphQL: 5,000 points/hour, at most 2,000 points/minute and 100 concurrent requests as secondary limits: [docs](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api). Two years of PRs × reviews × files is fine with nested pagination, but large PRs need extra paginated file calls.
- I found no published Graph Hacks winners. Search snippets even show an older/other edition with different tracks ([site](https://www.wemakedevs.org/hackathons/falkordb)), so judging preferences are unknown.

## Simulation
**Day 1:** choose a repo and write ingestion (fine). **Day 2:** derived edges and algorithms; weights aren't supported, so they get computed in Python. **Day 3:** embeddings, triage, MCP and corrections. **Day 4:** UI, evaluation, deployment, video. The 20-issue evaluation slips first. In the demo the path draws cleanly, but the "experts" are the same 2–3 core maintainers for every component. **Judge questions:** (1) "Does this beat 'assign to whoever last touched these files'?" There is no baseline. (2) "Where's the company brain: docs and decisions?" (3) "Which parts run inside FalkorDB?" (4) "What's the hit rate?" Probably 20 hand-picked issues and no baseline. (5) "Who uses this?" There's no answer for a public repo.

## Steelman / attack
**For:** the track text practically describes it. The data is real, public and verifiable. The bitemporal correction is a genuine graph-native idea. The MCP tools make it an agent, not a dashboard.
**Against:** it repackages a solved analytics problem. The algorithms are only nominally done in FalkorDB. Ownership in mid-size OSS is concentrated, so the answers are predictable. The scope is too big.

## TOP 3 FLAWS
1. **Trivial answers.** In vite or pydantic, PageRank over review edges crowns the 2–3 core maintainers in every component. On stage, `find_expert` returns the same person three times, and "ownership drift" turns out to be an arbitrary CODEOWNERS file, or one that doesn't exist (check this on day 1).
2. **The graph becomes decoration.** Weighted, recency-decayed PageRank and weighted label propagation aren't documented FalkorDB features. A judge asks, sees networkx, and the central rule fails.
3. **Scope collapse.** Bitemporal corrections, embeddings, a canvas and an evaluation all compete for day 4. The result is a half-finished UI and a hit rate with no baseline that judges discount.

## THE BEST VERSION
Cut derived components (use CODEOWNERS or folders) and the custom canvas (use the FalkorDB Browser or a simple viz). Keep the triage path with cited hops, the drift and bus-factor view, and the timestamped corrections. Do recency weighting in Cypher (sum of decayed edge counts along the path) so it truly runs in FalkorDB. Compare against a "last file toucher" baseline on 30+ issues. Pick the repo for diffuse ownership (many reviewers per area), not fame. Pitch usefulness as "onboarding for a company's internal monorepo", with the public repo as a stand-in.

## VERDICT
Build it with changes: it fits the track, but it will look like more than a re-skinned CodeScene only with a cut scope, ranking logic that runs in Cypher, and a baseline comparison.
