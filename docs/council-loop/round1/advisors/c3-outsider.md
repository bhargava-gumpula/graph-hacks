# Outsider review: candidate 3, "npm maintainer blast radius"

I read this as a smart non-specialist would. The pitch makes sense in one sentence: "one phished password poisoned 2 billion weekly downloads last year; this shows whose password is next." People remember it and get it straight away. Most graph-hackathon entries can't say that.

## SCORES (1–10)
- **Graph essential: 8.** Reverse variable-length traversal, PageRank and betweenness are the product, and FalkorDB ships `algo.pageRank`, `algo.BFS` and `algo.betweenness`. It isn't a 9 because a skeptic could say "networkx does this offline".
- **Demo memorability: 8.** Replaying a real, famous attack with a download counter that keeps climbing is the strongest opening a judge could see. The lockfile paste makes it personal.
- **4-day feasibility for one builder: 6.** Crawling 20k–40k packuments is doable, but the bulk downloads API takes only 128 packages per call and doesn't support scoped packages. Lockfile parsing, the animation, MCP and deployment all have to fit around that. The brief promises six features; four is realistic.
- **Originality vs competitors: 5.** Zimmermann et al. (USENIX Sec '19) ran this exact maintainer-reach analysis, and deps.dev tried PageRank with authorship edges. What's new is the interactive agent and the replay, not the insight.
- **Real-world usefulness: 6.** AppSec teams care about this, but the output is hard to act on ("remove chalk" isn't realistic). The npm `maintainers` list also isn't the same as real publish rights (org teams, trusted publishing).

## WIN CHANCE (main track): ~10%
With 100–300 real submissions, a polished, well-timed security story that FalkorDB can use in its marketing ranks in the top tier. It loses to entries that are more "agentic" (agents taking actions, not just answering questions) and to anything with a slicker live UI. If the replay doesn't run smoothly live, the edge disappears.

## EVIDENCE
- The Sept 2025 compromise happened as the brief says: Qix was phished, 18 packages including chalk and debug were hit, and estimates range from about 2B to 2.6B weekly downloads ([Check Point](https://blog.checkpoint.com/crypto/the-great-npm-heist-september-2025/), [Security Boulevard](https://securityboulevard.com/2025/09/how-one-phishing-email-compromised-18-npm-packages-and-billions-of-installs)). The demo should say "about 2B" and cite a source.
- Prior art: a 2019 paper found that a few maintainer accounts can reach most of npm ([USENIX](https://usenix.org/conference/usenixsecurity19/presentation/zimmerman), [paper](https://arxiv.org/pdf/1902.09217)), and deps.dev ran PageRank with shared-author edges to find single points of failure ([deps.dev blog](https://blog.deps.dev/combining-dependencies-with-commits)). I found no maintained open tool that does this end to end.
- FalkorDB procedures `algo.pageRank(label, relType)`, `algo.BFS(src, maxLevel, relType)` and `algo.betweenness(config)` exist ([procedures](https://docs.falkordb.com/cypher/procedures), [algorithms](https://docs.falkordb.com/algorithms)).
- The downloads API bulk limit is 128 packages and excludes scoped packages ([npm docs](https://github.com/npm/registry/blob/main/docs/download-counts.md)).
- After Shai-Hulud, GitHub moved npm toward FIDO 2FA and trusted publishing, which changes who can actually publish ([GitHub blog](https://github.blog/news-insights/company-news/our-plan-for-a-more-secure-npm-supply-chain/), [The Hacker News](https://thehackernews.com/2025/09/github-mandates-2fa-and-short-lived.html)).
- No past WeMakeDevs/FalkorDB winners are published. One search result showed a "Graph Hacks: Building Next-Gen RAG" listing with $10k and different tracks ([wemakedevs schedule](https://www.wemakedevs.org/hackathons/falkordb/schedule)). It may be a stale cache, but **re-check the tracks on the official site**.

## Simulation (short)
- **Day 1:** the crawler and cache. Risk: scoped packages need one downloads call each, which could mean thousands of calls.
- **Day 2:** load the graph, add the reach query, compute PageRank and betweenness.
- **Day 3:** MCP tools, the agent and the canvas replay.
- **Day 4:** lockfile exposure, deploy, video.

**The 2-minute demo:**
- Shot 1 is the replay. It works if the reach set has been pre-computed. A live traversal over about 30k nodes with full closure could stall.
- Shot 2 shows ten real names on screen.
- Shot 3 is the lockfile paste, which is fine.

**What a judge will ask:**
- "Isn't this the 2019 paper?"
- "Does the maintainer list reflect real publish rights?"
- "Why an agent and not a dashboard?"
- "What should I actually do with this?"
- "Is a ranked list of people to phish responsible?"

## TOP 3 FLAWS
1. **Ranking named people reads as a phishing target list.** The scenario: shot 2 puts ten real maintainer handles on screen labelled "next to compromise", and a judge (or FalkorDB's marketing team) won't promote it. Rank packages and show maintainers only as anonymised counts.
2. **Stale or wrong publish-rights data.** The scenario: a judge points out that a package uses org-team or trusted publishing, so the "single maintainer" claim is false and trust in the whole output falls apart.
3. **Too much scope for four days.** The scenario: the crawler problems eat day 2, and the replay animation or the lockfile feature ships half-broken in the video.

## THE BEST VERSION
- **Keep:** the attack replay, single points of failure by package, lockfile exposure, and 3 MCP tools that show their Cypher.
- **Cut:** betweenness (keep PageRank), Advisory/Repo nodes, and the "one removal" optimiser (swap in "the top 3 riskiest paths").
- **Add:** pre-computed reach per maintainer stored as graph properties for an instant replay, and a "what changes if this package adopts trusted publishing/2FA" toggle. That turns it into an action, not just a scare chart.

## VERDICT
Build it with changes: the story is clear and memorable and the graph genuinely does the work, but anonymise people, trim scope to three polished features, and be upfront that the core insight dates from 2019.
