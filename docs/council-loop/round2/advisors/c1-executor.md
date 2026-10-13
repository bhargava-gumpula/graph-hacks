# Candidate 1, Executor review: npm stolen-token exposure agent

## SCORES (1–10)
- **Graph essential: 7.** Floating-edge reach, worm contagion rounds and PageRank are graph work by nature. But for feature 1 the lockfile already lists the full transitive closure, so a judge can say "a script over package-lock.json does this." The worm and harden-10 features are what make the graph necessary.
- **Demo memorability: 7.** A real Shai-Hulud replay spreading round by round, then stopped by one toggle, is a strong 2-minute visual. Swap in the placeholder numbers only if the real run supports them.
- **4-day feasibility for one builder: 5.** The crawl is easy: I fetched packuments live and the `maintainers` and `dist.attestations` fields are there. The cost is in five features plus a canvas plus validation. Feature 4 depends on reconstructing a 2025 graph from 2026 "latest" data, and that is where the time goes.
- **Originality vs competitors: 6.** The academic result is from 2019. deps.dev, npm-blast-radius and at least one lockfile "blast radius" web tool already exist. The new parts are worm modelling plus auto-fix.
- **Real-world usefulness: 5.** Platform and security teams would care. But the threat model is partly out of date: npm revoked classic tokens and is moving publishing to "disallow tokens". And provenance does not block a token publish.

## WIN CHANCE (main track): ~6%
This is in the top quartile for theme fit: security triage is a named example in track 1, and it has typed MCP tools, Cypher on screen, and an action (a PR). Against that, 100–300 submissions compete for one prize, judges are FalkorDB people who reward visible graph and agent work over domain correctness, and npm-literate judges will find the modelling holes below.

## EVIDENCE
- Live registry check (registry.npmjs.org/<pkg>/latest): `vite` and `@sigstore/sign` carry `dist.attestations.provenance` (SLSA v1). `debug` does not. All three list maintainers with emails, so hashing is needed. `api.npmjs.org` (download counts) was blocked from my sandbox. Expect quirks there.
- npm documents no numeric public rate limits, and `_changes` pages are capped at 10k ([apis.io](https://apis.io/rate-limits/npm/npm-rate-limits/)). Crawling 15k packuments is fine.
- GitHub's post-Shai-Hulud plan: deprecate classic tokens, shorten granular token lifetimes, default to disallowing tokens ([GitHub blog](https://github.blog/2025-12-15-our-plan-for-a-more-secure-npm-supply-chain/), [Heise](https://www.heise.de/en/news/After-major-attack-Package-manager-NPM-cuts-old-security-ties-10772190.html?view=print), [Hacker News](https://thehackernews.com/2025/09/github-mandates-2fa-and-short-lived.html)). Provenance is an attestation, not a publish lock ([GitHub provenance](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/)).
- Shai-Hulud counts vary by wave: 180, 500+, and 1,300 versions in the 2026 keyv/"ChainDrop" wave ([CSA SG](https://csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009), [Ampcus](https://www.ampcuscyber.com/shadowopsintel/500-npm-packages-poisoned-in-shai-hulud-worm-attack/), [Cycode](https://cycode.com/blog/shai-hulud-npm-supply-chain-attack/)). There is no single ground-truth list.
- Prior art: [Small World with High Risks](https://blog.acolyer.org/2019/09/30/small-world-with-high-risks/), [deps.dev](https://deps.dev) plus its [maintainer-concentration work](https://blog.deps.dev/combining-dependencies-with-commits), [npm-blast-radius](https://classic.yarnpkg.com/en/package/npm-blast-radius) (one hop only), and a lockfile path tracer on Render.
- FalkorDB has `algo.pageRank`, `algo.bfs`, `algo.SPpaths/SSpaths` ([docs](https://docs.falkordb.com/algorithms), [BFS](https://docs.falkordb.com/algorithms/bfs)). The docs warn about exponential blow-up at large BFS depths. No past WeMakeDevs/FalkorDB winners were findable ([event page](https://www.wemakedevs.org/hackathons/falkordb)).

## SIMULATION
- **Day 1:** pick the seed list (there is no official "top 2,000 most depended-on"; this costs about 2 hours via deps.dev or a community list), crawl, load. This is fine.
- **Day 2:** lockfile exposure and overrides recompute. Packages in the lockfile but outside the closure need a live fetch fallback.
- **Day 3:** worm loop plus canvas. Rendering 10k nodes forces subgraph filtering, which takes half a day.
- **Day 4:** validation. Seeded from a 2026 "latest" graph, the 2025 worm overlap is likely near zero, because the victims (@ctrl, CrowdStrike, PostHog) mostly sit outside the top-2,000 closure. Pinning every number to the published README hurts.

**Five questions from a skeptical judge:**
1. "A lockfile pins versions; `npm ci` never pulls a new release. What is exposed?" The only honest answer is "the next `npm update` or fresh install."
2. "Provenance isn't a publish lock, is it?" It isn't.
3. "Do classic tokens still exist?" They were revoked in 2025.
4. "Why FalkorDB over a Python BFS?"
5. "Precision and recall?" The answer will be weak.

## TOP 3 FLAWS
1. **The barrier model is wrong.** Treating provenance as a barrier is false, and the real barrier ("disallow tokens") is not in public metadata. Failure: a judge from the security world says it and the harden-10 shot loses credibility.
2. **Validation backfires.** A graph built from latest versions in October 2026, replayed against September 2025, gives single-digit recall. The headline "validated against reality" turns into a self-inflicted weakness in the README.
3. **Scope.** Five features, a canvas, an agent, a deployment and video. Failure: the day-3 cut line triggers, and what ships is feature 1, which is the least graph-necessary piece.

## THE BEST VERSION
- **Keep:** the graph model, floating edges, worm mode, overrides recompute, 4 MCP tools with visible Cypher.
- **Change:** rename the barrier from provenance to "token-proof publishing (trusted publishing only)". Present provenance as a proxy and state the assumption. Frame exposure as "on the next lockfile refresh."
- **Validate on the 2026 keyv wave** instead. Its victims (keyv, flat-cache, file-entry-cache) sit inside an ESLint-heavy top-2,000 closure, and the timing fits a current snapshot.
- **Cut:** harden-10 becomes a single toggle. Drop separate download metrics.

## VERDICT
Build it with changes: fix the provenance/lockfile modelling, validate on the 2026 wave, and lead the demo with worm mode rather than the lockfile report.
