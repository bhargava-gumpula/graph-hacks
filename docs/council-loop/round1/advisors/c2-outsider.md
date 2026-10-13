# Outsider review: Candidate 2, an issue-triage agent that finds the real expert in a repo

**Pitch in one breath:** "Paste a GitHub issue. The graph shows who actually knows this code, and that the listed owner hasn't touched it in 14 months." A first-time viewer gets that in about ten seconds. The problem is familiar to every developer judge.

## SCORES (1–10)
- **Graph essential: 7.** The path issue → past issue → PR → files → component → experts is real multi-hop work, and PageRank and label propagation are native FalkorDB procedures. But a skeptic can say "expert = count of PRs per folder" works in SQL, so the graph has to visibly beat a plain count.
- **Demo memorability: 6.** The greyed-out owner with "no activity in 14 months" is a strong moment. Everything else (co-change clusters, bus factor, as-of queries) is dashboard material that blurs together in two minutes.
- **4-day feasibility for one builder: 5.** Each piece is doable, but the brief stacks about nine features: ingestion, two derived graphs, CDLP, recency-weighted PageRank, embeddings, a bitemporal correction model, 3 MCP tools, a canvas, and a 20-issue eval. That over-promises.
- **Originality vs competitors: 5.** Reviewer recommenders, CodeScene knowledge maps and checkowners already do "who knows this code" and bus factor. What's new is the issue-to-expert path with cited hops, served over MCP.
- **Real-world usefulness: 6.** Maintainers of large repositories triage all day, and CODEOWNERS files do go stale. Big projects already know their experts informally, though, and corporate teams would want this on private repositories, which the demo doesn't show.

## WIN CHANCE (Company Brain): about 8%
The idea is clean, readable and on-theme for "who owns and knows what". However, Company Brain explicitly says "docs, tickets and chats". A repository-only graph reads closer to Track 1's own "codebase" example, so a judge may see it as a weaker fit. With perhaps 150–250 real submissions and many "who knows what" brains likely, a polished build lands in the top 10%. It wins only if the live correction and the drift reveal land cleanly.

## EVIDENCE
- Prior art for reviewer and expert recommendation (RevFinder, ChRev, Sofia algorithms; the Review Recommender tool). None route *issues* to experts by graph path: [reviewrecommender](https://reviewrecommender.readthedocs.io/en/latest/), [Masud ASE2016 CORRECT](https://web.cs.dal.ca/~masud/papers/masud-ASE2016a-pp.pdf). GitHub's own [AI issue triage](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/triaging-an-issue-with-ai) judges whether an issue is actionable, not who should handle it.
- Ownership, drift and bus factor already exist: [checkowners](https://pypi.org/project/checkowners/0.4.0/) infers CODEOWNERS and expertise decay; [truckfactor](https://pypi.org/project/truckfactor/0.2.1/); CodeScene [knowledge maps and off-boarding simulation](https://docs.enterprise.codescene.io/versions/4.0.2/guides/simulations/offboarding-simulator.html), including "code by former contributors".
- FalkorDB supports `algo.pageRank(label, relType)` and `algo.labelPropagation({nodeLabels, relationshipTypes})` ([algorithms](https://docs.falkordb.com/algorithms), [CDLP](https://docs.falkordb.com/algorithms/cdlp)). I found no edge-weight parameter documented for PageRank, so "recency-weighted" probably needs a workaround, such as pre-filtered subgraphs or weights applied afterwards.
- A vector index is available via `db.idx.vector.queryNodes` with `vecf32` and fixed dimensions ([vector index](https://docs.falkordb.com/cypher/indexing/vector-index)).
- GitHub GraphQL allows 5,000 points per hour plus secondary limits (2,000 points per minute, 100 concurrent) ([GitHub docs](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)). Two years of vite's PRs, reviews and files fit, but paginating PR files takes hours, not minutes.
- I found no published WeMakeDevs graph-hackathon winners. Search results for the [event page](https://www.wemakedevs.org/hackathons/falkordb) also showed an older "Next-Gen RAG" listing with different tracks. Re-check the live track text before submitting.

## Simulation (short)
**Build:** day 1 goes to ingestion and the schema, with rate-limit pauses. Day 2: CDLP, PageRank and drift. Day 3: embeddings, the triage path and MCP. Day 4: the canvas, corrections and the eval. The as-of correction model and the eval are what slip.

**Demo:** shots 1–3 (paste issue, path draws, owner greyed) work. Shot 4 (correction) works if pre-rehearsed.

**Judge questions:**
1. Why not just count commits?
2. What's your hit rate versus CODEOWNERS?
3. Is calling a real maintainer "drifted" fair?
4. Why Company Brain with no docs or chats?
5. What happens on an issue with no similar past issue?

Questions 1, 3 and 5 are where it breaks.

## TOP 3 FLAWS
1. **Scope creep.** On Friday night the canvas works but the bitemporal corrections and the 20-issue eval are half-done. The README then reports a hit rate from 8 issues, which undercuts the "with evidence" claim.
2. **Weak baseline story.** A judge asks "does PageRank beat 'most PRs in this folder'?" There's no answer, and the graph starts to look like decoration.
3. **Naming real people.** The demo publicly labels a real vite or pydantic maintainer as a stale owner. That's awkward for judges and maintainers, and it can be wrong if they review via Discord or commit under another email.

## THE BEST VERSION
- **Keep:** the issue → expert path with Cypher shown, ownership drift, `triage` and `find_expert` over MCP, and the hit-rate eval (make it 20 issues, compared against CODEOWNERS and a "most commits" baseline).
- **Cut:** the as-of time-travel queries (keep a simple correction that overrides the answer), CO_REVIEWED, and the side-by-side folder comparison.
- **Add:** one slide showing "graph rank vs. naive count" winning on concrete issues, and an anonymize toggle for names in the video. Lead with Track 1 as co-primary.

## VERDICT
Build it with changes: the pitch is clear and useful, but cut it to the path, drift and eval, and prove the graph beats a simple count.
