# Candidate 2: issue-triage expert finder (Expansionist review)

## SCORES (1–10)
- **Graph essential: 8.** The answer is a 5-hop path (issue → similar issue → fixing PR → files → component → experts), plus CDLP communities, PageRank and time-bounded OWNS edges. Take FalkorDB out and the product has nothing left to show. It isn't a 9 because the weighting has to be done by hand (see Flaw 1).
- **Demo memorability: 7.** "Your CODEOWNERS is lying: the declared owner hasn't touched this in 14 months" is a punchline that sticks. A correction that changes the answer live, with an "as of" view, is rare at hackathons.
- **4-day feasibility: 6.** Ingesting from the GitHub API, running two algorithms, doing local embeddings, exposing 3 MCP tools and building a canvas is a lot of surface for one person. It is reachable with parallel agents if the repo is chosen and ingested on day 1.
- **Originality: 6.** checkOwners, JetBrains bus-factor-explorer and git-suggest-reviewers already do expertise and bus factor from git. Nobody I found combines issue → fix-path triage, valid-time corrections and MCP over a live graph.
- **Real-world usefulness: 7.** Maintainers of large OSS projects and internal platform teams have this routing pain right now. The OSS framing gives a real user you can name, but most real teams would want this run on their own private repos.

## WIN CHANCE (Company Brain): ~9%
With maybe 150–250 real submissions spread over 3 tracks, Company Brain might get 50–80. Most will be generic "RAG over Notion/Slack" bots. This idea covers four of the track's bullets with real data: who owns and knows what, tracing decisions to their source, keeping knowledge current, and answers with sources. It also qualifies for Track 1 as a second shot. Typical odds would be 1–2%; well executed, this could reach 10–15%. I discount for execution risk and an unknown rubric.

## EVIDENCE
- FalkorDB `algo.pageRank(label, relType)` is **unweighted** and has no personalization or subgraph filter; scores come from incoming edges ([PageRank docs](https://docs.falkordb.com/algorithms/pagerank.md)). "PageRank weighted by recency within a component" does not exist as a built-in.
- `algo.labelPropagation({nodeLabels, relationshipTypes, maxIterations})` exists, but I found no edge-weight option ([CDLP](https://docs.falkordb.com/algorithms/cdlp.md), [procedures](https://docs.falkordb.com/cypher/procedures)).
- Native HNSW vector index via `vecf32` and `db.idx.vector.queryNodes`. Plain lists silently fail to index ([vector index](https://docs.falkordb.com/cypher/indexing/vector-index), [pitfall report](https://aicoding.csdn.net/6a5de1b910ee7a33f28f6617.html)).
- An official FalkorDB MCP server exists (Cypher, multi-graph, read-only mode), so custom tools on top of it are credible ([docs](https://docs.falkordb.com/genai-tools/mcpserver), [listing](https://mcpservers.org/servers/FalkorDB/FalkorDB-MCPServer)).
- Prior art: [checkOwners](https://dev.to/smusali/meet-checkowners-confidence-scored-codeowners-from-your-git-history-4280) (CODEOWNERS from git, bus factor, expertise decay), [git-suggest-reviewers](https://github.com/xiongchiamiov/git-suggest-reviewers), [JetBrains ICTL bus-factor work](https://lp.jetbrains.com/research/ictl/), [CORRECT reviewer recommender](https://web.cs.dal.ca/~masud/correct). GitHub's native team auto-assign only does round robin or load balance ([overview](https://oneuptime.com/blog/post/2026-01-25-code-review-automation/view)).
- GitHub GraphQL allows 5,000 points/hour and 2,000 points/minute, and connection cost scales with the nodes traversed ([GitHub docs](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)). Two years of vite PRs with reviews and files fits, but only with batched queries.
- I could not find any past WeMakeDevs winners online, only prize totals and a Telegram announcement ([WeMakeDevs](https://t.me/s/WeMakeDevs)).

## Simulation
- **Day 1:** pick the repo and backfill (about 4h if batched, but file lists on huge PRs paginate). **Day 2:** CO_CHANGED/CO_REVIEWED derivation, CDLP, expert ranking. **Day 3:** triage path, embeddings, MCP tools, corrections. **Day 4:** canvas, test set, video, tunnel.
- **Breakage points:** PageRank on a bipartite Person→PR graph gives authors near-zero scores, because nobody points *to* a Person. CDLP on a dense co-change graph can collapse into one giant community because of lockfiles and CHANGELOG.
- **Judge's questions:**
  1. "Why PageRank and not a count?" Answer: run it on CO_REVIEWED.
  2. "Hit rate vs CODEOWNERS baseline?" This must be shown.
  3. "Does this break on bots like renovate?"
  4. "Where does recency enter?"
  5. "Is the graph essential?" This one is fine.

**Steelman:** real public data, a path you can verify, a provocative finding about a famous repo, and both tracks covered. **Attack:** the features are broad, the algorithms need workarounds, and "who reviewed" can already be read from GitHub.

## TOP 3 FLAWS
1. **The brief promises an algorithm FalkorDB doesn't have.** At hour 30 the builder finds PageRank is unweighted and global, and spends the evening hacking per-component subgraphs. Fix: materialize a recency-decayed `(:Person)-[:CO_REVIEWED]` projection per component in a separate named graph (multi-graph is a FalkorDB strength, so show it off). Or score in Cypher with an explicit decay formula and keep PageRank as a secondary signal.
2. **Noise ruins the headline result.** Bots, release PRs and lockfiles dominate co-change, so the demo community is "everything" and the top expert is dependabot. Fix: filter on day 1 and check that CDLP produces sensible clusters before building UI.
3. **The 20-issue evaluation shows a weak hit rate, or no baseline.** "We got 11/20" with no comparison reads as weak. Fix: report it against a "CODEOWNERS only" baseline and a "most recent committer" baseline. Beating CODEOWNERS is the story.

## THE BEST VERSION
- **Cut:** live polling and three-way search (use shared file paths plus embeddings only if there's time).
- **Keep:** the triage path with cited Cypher, ownership drift, bus factor, and valid-time corrections.
- **Add, the upside others miss:**
  - (a) An "Ownership Drift Report" for vite: a single shareable page listing components whose declared owner has gone quiet. That doubles as the blog-post entry for the AirPods side prize, and maintainers may retweet it.
  - (b) Show the MCP tool being called from Claude Code on a real open issue in the video, which makes it an agent rather than a dashboard.
  - (c) The "as of" time-travel query rendered as a slider.
  - (d) Keep the repo pluggable so judges can point it at their own repo. That is a huge credibility boost even if it only runs as a 30-day backfill.

## VERDICT
**Build it with changes.** Narrow it to one repo with honest custom scoring and a measured baseline, and lean into the drift report and time-travel corrections, which are the standout features.
