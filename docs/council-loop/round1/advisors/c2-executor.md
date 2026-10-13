# Executor review: Candidate 2, issue-triage expert finder for a public repo

## SCORES (1–10)
- **Graph essential: 7.** The core path (issue → similar issue → fixing PR → files → component → people) is a real multi-hop traversal, and the ranking runs on graph algorithms. But both headline algorithms need workarounds in FalkorDB (see Evidence), so some of the work will end up in Python.
- **Demo memorability: 6.** The greyed-out "no activity in 14 months" owner and the live correction are good beats. Still, "who reviews this" is a calm, back-office story, and the canvas path is the same kind of visual many graph entries will show.
- **4-day feasibility for one builder: 5.** Ingest plus the traversal is easy. The brief also promises eight more things: derived components, recency-weighted PageRank per component, drift, bus factor, embeddings, bitemporal corrections, 3 MCP tools, a 20-issue eval, a canvas UI and a deployment. That over-promises for 4 days.
- **Originality vs competitors: 5.** Reviewer recommendation is a well-studied research area (RevFinder, CORRECT, Sofia) and has existing tools. FalkorDB's own Code-Graph already turns repos into graphs. The new part is the "drift plus correction as dated fact" angle.
- **Real-world usefulness: 6.** Maintainers of mid-size OSS projects and internal platform teams have this routing pain. But GitHub already auto-assigns reviewers through CODEOWNERS, and nobody will change their workflow because of a 4-day demo.

## WIN CHANCE (Company Brain): ~5%
The idea fits the track text closely ("who owns and knows what", "answers with sources", "keeping knowledge current"). But it only uses one source type: code activity, with no docs or chats. That is thinner than what the track describes, and many entrants will pick the obvious "GitHub repo as company brain" idea. With 100–300 real submissions, a clean and well-executed version lands in the top 10–15%. Winning outright needs polish that the scope doesn't leave time for.

## EVIDENCE
- **FalkorDB PageRank:** the documented signature is `algo.pageRank(label, relationship-type)`. It takes no weights and no property filter ([docs src](https://raw.githubusercontent.com/FalkorDB/docs/main/algorithms/pagerank.mdx)). "Recency-weighted, within a component" therefore means writing temporary per-component labels or graphs, or computing in Python. That hurts the "graph does the work" claim.
- **FalkorDB label propagation:** config is only `nodeLabels`, `relationshipTypes` and `maxIterations`, with no weights ([docs src](https://raw.githubusercontent.com/FalkorDB/docs/main/algorithms/cdlp.mdx)). The weighted CO_CHANGED graph loses its weights, and dense hub files (package.json, changelogs) will merge everything into one community unless they are filtered out first. Algorithm list confirmed: [FalkorDB docs repo](https://github.com/FalkorDB/docs/tree/main/algorithms).
- **Vector index:** HNSW, cosine, `db.idx.vector.queryNodes` ([vector index docs](https://docs.falkordb.com/cypher/indexing/vector-index)). The similar-issue step is supported.
- **CODEOWNERS:** I found no file at `vitejs/vite/.github/CODEOWNERS`, `vitejs/vite/CODEOWNERS` or `pydantic/pydantic/.github/CODEOWNERS` (all returned 404). The "declared owner greyed out" demo beat depends on a source that may not exist for either named candidate. The day-1 repo test is essential, not a formality.
- **GitHub API:** 5,000 points/hour, plus secondary limits of 2,000 points/minute and nested-connection cost blow-ups ([GitHub GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)). Two years of PRs with files and reviews takes a few hours of careful paging, which is fine if done once on day 1.
- **Prior art:** [Review Recommender](https://reviewrecommender.readthedocs.io/en/latest/), [CORRECT (arXiv)](https://arxiv.org/abs/1807.04130v1), [GitHub AI issue triage](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/triaging-an-issue-with-ai), [FalkorDB Code-Graph](https://docs.falkordb.com/genai-tools/code-graph.md).
- **Past winners:** I found no public list of winning projects for past WeMakeDevs hackathons ([WeMakeDevs Telegram](https://t.me/s/WeMakeDevs)). Judges' stated praise centred on "creativity, technical depth, innovative use" of the sponsor tech.

## SIMULATION (where it breaks)
- **Day 1:** pick the repo (CODEOWNERS check), GraphQL ingest, schema. Risk: pagination of nested files and reviews eats the afternoon.
- **Day 2:** co-change, label propagation, PageRank, drift. Breaks when label propagation returns one giant component and the builder spends hours tuning hub-file filters.
- **Day 3:** embeddings, triage path, Claude draft, MCP tools, corrections with valid_from and valid_to. Breaks on "as of" queries: every expert query now needs time filters.
- **Day 4:** canvas UI, the 20-issue eval, tunnel, video, README. The eval gets cut or faked.
- **Demo:** the paste-issue shot works only if a pre-chosen issue is used. A truly fresh issue often matches nothing well.
- **Judge questions:**
  1. Why is this better than CODEOWNERS plus `git blame`?
  2. Is the PageRank actually recency-weighted inside FalkorDB?
  3. What is the hit rate, and what is the baseline (most-recent-committer)?
  4. Where are the docs and chats for Company Brain?
  5. Does it still work without FalkorDB? (Partially, if ranking moved to Python.)

## STEELMAN / ATTACK
- **For:** real public data, a crisp evidence path, an honest eval, and a direct fit for the track language. The correction-as-dated-fact beat is clever, and the graph is required for the traversal.
- **Against:** a crowded research niche, algorithm gaps in FalkorDB, a key demo beat that depends on a file the candidate repos may lack, and scope for two people.

## TOP 3 FLAWS
1. **Scope.** On Thursday night the UI, MCP tools and eval are all half-done, and the video shows a Cypher console instead of the promised canvas.
2. **Unweighted algorithms.** The "derived components" panel shows one blob containing 70% of files, and the "real experts" list is just the most prolific committers overall.
3. **Missing CODEOWNERS.** The drift beat has nothing to compare against. The builder switches repos on day 2 and has to re-ingest.

## THE BEST VERSION
- **Cut:** label propagation (use folders as components), bus factor, polling updates, and two of the three MCP tools (keep `triage`).
- **Keep:** the traversal with Cypher shown, recency computed as edge properties and used in a Cypher scoring query, the drift beat and the correction beat.
- **Add:** a most-recent-committer baseline next to the 20-issue hit rate. Choose the repo by whether it has CODEOWNERS, verified before kickoff.

## VERDICT
Build it with changes: cut the derived-component and weighted-PageRank promises, then ship the traversal, drift and correction beats with a measured hit rate against a baseline.
