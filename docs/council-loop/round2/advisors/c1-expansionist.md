# Candidate 1 — Expansionist review (npm stolen-token exposure agent)

## SCORES (1–10)
- **Graph essential: 8.** Reach, shortest paths from accounts to a lockfile, and round-by-round contagion are all multi-hop traversals over a graph. Without FalkorDB the core feature is gone, so the "decoration" rule is clearly passed.
- **Demo memorability: 7.** "47 accounts can ship code into your app, and after 3 pins it's 9" is a strong hook. A worm replay checked against a real incident is rare for a hackathon. It is not a 9 because the numbers are placeholders, and a weak overlap could deflate the climax.
- **4-day feasibility for one builder: 5.** Crawling about 10k packages, two graph models, contagion, greedy hardening, a canvas, MCP and a deployment add up to a full roadmap. The cut line helps, but day 1 carries the most risk (crawl plus provenance data).
- **Originality vs competitors: 6.** The account-reach idea dates from 2019 (Zimmermann et al.). Scoping it to one lockfile, splitting floating vs pinned edges, and proposing the fix is new as a product. Socket and similar tools score individual packages, not paths.
- **Real-world usefulness: 6.** After Shai-Hulud the pain is real, and pnpm 11 made release-age delays the default. That partly removes the "action" step, and the provenance-as-barrier assumption is wrong (see flaws).

## WIN CHANCE (Agents That Act on Connected Data): ~7%
The idea is squarely on-track: graph algorithms as agent tools, MCP, an explainable path and an action. Security triage is literally one of the track's listed examples. The topic is timely enough to stand out among maybe 100–300 real entries, many of which will be generic GraphRAG chatbots. It loses points for execution risk and because a security-literate FalkorDB judge may poke at the threat model. A polished version with a validated replay could reach 12–15%.

## EVIDENCE
- **Prior art:** a small set of maintainer accounts could push code into most of npm. On average a package implicitly trusts 79 packages and 39 maintainers ([arXiv 1902.09217](https://arxiv.org/pdf/1902.09217), [USENIX slides](https://www.usenix.net/sites/default/files/conference/protected-files/sec19_slides_zimmermann.pdf), [summary](https://blog.acolyer.org/2019/09/30/small-world-with-high-risks/)). The paper has no per-project fix step.
- **Shai-Hulud data is messy:** wave 1 started from rxnt-authentication with 180+ packages ([Black Duck](https://blackduck.com/blog/npm-malware-attack-shai-hulud-threat.html)). Wave 2 hit 600–800 packages, or 198 confirmed plus 410 potential depending on the source ([Invicti](https://www.invicti.com/blog/web-security/shai-hulud-2-worm-supply-chain-attack-on-npm-dependencies), [Phoenix](https://phoenix.security/?p=38125)). A 2026 "keyv" wave covers 1,300+ versions ([CSA SG](https://csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009)). There is ground truth to validate against, but its "truth" set is fuzzy.
- **Provenance is not a barrier:** a 2026 worm published with stolen credentials and its versions showed **valid provenance** ([arrangeactassert](https://arrangeactassert.com/posts/the-trusted-publishing-setting-that-would-have-blocked-the-npm-snapshot-branch-attacks/)). Tokens keep working until revoked ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers)). Provenance adoption is about 12.6% in one top-2,000 sample ([lilting.ch](https://lilting.ch/en/articles/npm-ai-account-no-provenance)).
- **Release-age delay already exists:** pnpm's `minimumReleaseAge` defaults to 1440 minutes since v11. npm 11.10 reportedly added `min-release-age` ([pnpm settings](https://pnpm.io/settings), [lilting.ch](https://lilting.ch/en/articles/pnpm-11-minimum-release-age-default-shai-hulud-defense)).
- **FalkorDB support:** `algo.pageRank`, BFS and shortest-path procedures are confirmed ([docs](https://docs.falkordb.com/algorithms), [pageRank](https://docs.falkordb.com/algorithms/pagerank)).
- **Registry rate limits:** HTTP 429s are documented but no current numbers are published ([npm blog](https://blog.npmjs.org/post/164799520460/api-rate-limiting-rolling-out)).
- **Past WeMakeDevs winners:** I found no published list ([WeMakeDevs](https://www.wemakedevs.org/llms.txt)).

## SIMULATION (abridged)
- **Day 1:** the crawl of packuments (maintainers, dependency ranges) works. Provenance needs per-version attestation lookups, roughly 10k more calls, and 429s eat hours.
- **Day 2:** lockfile exposure works.
- **Day 3:** worm mode works.
- **Day 4:** the canvas, deployment and video squeeze out the validation step.
- **Demo shot 3 breaks if recall is around 15%,** which is likely: the graph holds latest versions only, the seed set is popular packages, and the worm actually spread through small long-tail packages.

Five questions a skeptical judge would ask:
1. "Your lockfile pins exact versions, so how is any edge floating?"
2. "Provenance didn't stop the 2026 worm."
3. "Isn't pnpm's default delay already the fix?"
4. "What's your recall?"
5. "Why do you need an LLM here?"

Questions 1 and 2 are the dangerous ones.

## TOP 3 FLAWS
1. **Lockfile semantics.** `package-lock.json` resolves every transitive version exactly. A judge asks why `^` matters, and the answer ("on the next `npm update` or fresh install") has to be framed up front or the headline number looks invented.
2. **Wrong barrier.** Treating provenance as blocking a stolen token is refuted by the 2026 worm. If the "Harden these 10" toggle depends on it, it demos a defense that failed in reality.
3. **Validation backfires.** The seed set is latest-only and covers only the top 2,000 packages, so worm overlap will be low. Reporting "recall 0.11" on stage kills the climax. Hiding it breaks the brief's own honesty promise.

## THE BEST VERSION
- **Keep:** lockfile exposure, the why-path, and the live recompute after edits. This is the winning moment.
- **Reframe the action** around three steps: what changes on your *next install/update*, which overrides to pin, and a release-age delay. Present the delay as the measured value of pnpm 11's default, which gives the tool credibility instead of competing with it.
- **Replace the provenance barrier** with "trusted publishing *plus tokens disallowed*" and label it as an assumption.
- **Upside to add:** an MCP server any coding agent can call before `npm install` ("does adding X widen my blast radius?"). This turns a report into an agent guardrail and fits both the track and the agent-tooling zeitgeist.
- **Validation:** seed from the actual compromised list's dependency neighborhood instead of only the top 2,000, and frame it as "which real victims were reachable," not as precision.
- **Cut** the greedy "Harden 10" step unless days 1–3 finish early.
- **Write the blog post** for the AirPods side prize.

## VERDICT
Build it with changes: the per-lockfile "who can ship code into your app, and the fix, recomputed live" moment can win the track, but only if the floating-vs-lockfile and provenance assumptions are corrected before a security-minded judge finds them.
