# First Principles advisor: Candidate 2 (OSS issue-triage expert finder)

**The underlying problem:** a new issue sits unrouted because nobody knows who currently understands the code it touches, and declared ownership (CODEOWNERS) goes stale. The answer that matters is "this person, because they recently changed and reviewed these files". Strip away the costume and that is a **recency-weighted count of author and review events per file set**, plus a lookup of similar past issues. A single SQL `GROUP BY` produces it. Only the multi-hop *evidence path* (issue → past issue → fixing PR → files → people) is graph-shaped by nature.

## SCORES (1–10)
- **Graph essential: 6.** The traversal path and the time-stamped OWNS facts belong in a graph. But the core ranking is just aggregation, and FalkorDB's `algo.pageRank(label, relType)` is documented without edge weights or subgraph filtering, so "PageRank within a component, weighted by recency" can't be done natively. The recency weighting would end up in Python.
- **Demo memorability: 6.** The greyed-out owner with "no activity in 14 months" and the live correction both land well. A path drawn on a canvas is a familiar hackathon visual.
- **4-day feasibility: 5.** Ingestion is easy, since a few thousand PRs fit within the 5,000-point GraphQL budget. The risk is breadth: label propagation, PageRank, embeddings, bitemporal facts, 3 MCP tools, a canvas, an eval set and a deployment, all from one builder.
- **Originality: 4.** Reviewer and bug-assignee recommendation is a research field 15+ years old. GitLab ships Suggested Reviewers, and busfactor, truckfactor and mcp-git-historian already do ownership, bus factor and orphaned code. "Who owns what" is also the Company Brain track's own example, so expect many look-alikes.
- **Real-world usefulness: 5.** Vite and pydantic have small core teams who already know who owns what. The real pain is in large companies, whose data this demo can't use.

## WIN CHANCE (Company Brain): ~7%
The brief is concrete and evaluated, and its "ownership drift" angle is sharp. Still, the track asks for "docs, tickets and chats in one graph", and this covers only the code and ticket slice. With 100–300 submissions and a theme that invites look-alikes, this sits above average but not near the top.

## EVIDENCE
- FalkorDB PageRank takes only a label and a relationship type, and its doc section is titled "Unweighted PageRank". Label propagation (CDLP) takes a `nodeLabels` config. Vector indexes exist. [pagerank](https://docs.falkordb.com/algorithms/pagerank.md), [cdlp](https://docs.falkordb.com/algorithms/cdlp.md), [procedures](https://new.docs.falkordb.com/cypher/procedures.md)
- An official FalkorDB MCP server exists, so wrapping three tools is cheap but not novel. [MCP server](https://docs.falkordb.com/genai-tools/mcpserver)
- GitLab Suggested Reviewers already ranks by "recency, domain experience, and frequency" over a contribution graph. [GitLab](https://docs.GitLab.com/ee/user/project/merge_requests/reviews/data_usage.html)
- Prior art: [busfactor](https://github.com/k41n/busfactor) generates CODEOWNERS and finds orphaned code. Also [truckfactor](https://pypi.org/project/truckfactor), [mcp-git-historian](https://glama.ai/mcp/servers/AleBrito124356/mcp-git-historian), [mention-bot](https://github.com/mwarkentin/mention-bot) and the [Degree-of-Authorship analyzer](https://www.cs.ubc.ca/~daa/assets/ExpertiseAnalyzer.pdf).
- Bug-triage research finds that learned methods barely beat strong baselines. [arXiv 2305.18650](https://web3.arxiv.org/pdf/2305.18650)
- GitHub GraphQL limits: 5,000 points per hour, 2,000 points per minute, and undisclosed secondary limits. [GitHub docs](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- I found no published winners from past FalkorDB or WeMakeDevs hackathons. [event](https://www.wemakedevs.org/hackathons/falkordb)

## Simulation
- **Day 1:** ingest, schema, CODEOWNERS. Breaks on bot authors (renovate, dependabot) and squash merges hiding the real authors.
- **Day 2:** co-change graph and label propagation. Breaks because hub files (CHANGELOG, lockfiles, package.json) merge everything into one giant community.
- **Day 3:** triage chain, embeddings, Claude calls, MCP tools.
- **Day 4:** canvas, eval, tunnel, video. The eval and the polish get squeezed first.

**Demo:** the paste and the path draw well. The correction moment depends on the correction overriding the computed ranking, and the brief never defines how the two are combined.

**A skeptical judge asks:** (1) Why PageRank and not counting? (2) What is your hit rate against "last person to touch these files" and against CODEOWNERS? (3) Did the test issues' own fixing PRs leak into the graph? (4) Does it work without FalkorDB? (Yes, in Postgres.) (5) Which Vite maintainer asked for this? Questions 1, 2 and 4 currently have weak answers.

## Steelman / Attack
- **For:** real public data, a measurable eval, explainable paths, a clear story about stale ownership, and MCP fits naturally. It is honest work that judges can verify.
- **Against:** the expensive algorithms are decoration on top of a counting problem. PageRank on Person→PR edges doesn't measure expertise. The product duplicates GitLab's built-in feature. And its users, OSS maintainers, don't have this problem badly.

## TOP 3 FLAWS
1. **Algorithm costume.** A judge asks "why PageRank?". The honest answer is that a weighted degree count gives the same top 3, which proves the point the graph was meant to refute.
2. **Eval leakage or no baseline.** The README reports, say, 70% hits, but the fixing PR's reviewer was already in the graph, or "most recent file toucher" scores 68%. Either way the number is meaningless.
3. **Community detection collapses.** Label propagation on raw co-change data returns 2 giant clusters, so the "derived components vs folders" panel shows nothing useful.

## THE BEST VERSION
- **Cut:** PageRank as the headline and the CO_REVIEWED edges.
- **Keep:** the multi-hop evidence path as the hero, ownership drift, bus factor and the time-stamped corrections.
- **Add:** a time-split eval against two baselines (CODEOWNERS and last toucher), with hub files filtered out before label propagation.
- **Reframe:** Company Brain for any org, with OSS as the public demo dataset.
- **Show the Cypher path query** as the reason the graph is needed: variable-length traversal with `valid_from`/`valid_to` filters in one query.

## VERDICT
Build it with changes: make the multi-hop, time-aware evidence path the core and prove it against simple baselines, rather than leaning on PageRank and label propagation that a counting query would match.
