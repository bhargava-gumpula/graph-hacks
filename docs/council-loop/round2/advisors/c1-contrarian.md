# Candidate 1: Contrarian review (npm stolen-token exposure agent)

## SCORES (1–10)
- **Graph essential: 8.** Shortest paths, reach and contagion over DEPENDS_ON/CAN_PUBLISH edges are graph work at their core. If you take FalkorDB out, the product has nothing left.
- **Demo memorability: 6.** A worm spreading round by round on a canvas looks good. But "47 → 9" is a number from a model the judges can't check, and feature 4, the one result that would make the demo stick, is cut first if time runs short.
- **4-day feasibility for one builder: 5.** The crawl and graph load fit in a day. But provenance needs per-version attestation lookups, the account→package mapping is a guess, and five features plus a canvas plus MCP is a lot of work.
- **Originality vs competitors: 6.** "Few accounts reach most of npm" has been published since 2019. Socket, Snyk and deps.dev own the scanning market. The worm replay and the auto-generated fix are the new parts.
- **Real-world usefulness: 4.** The core exposure number rests on two assumptions that are false (below). A security engineer would reject it within minutes.

## WIN CHANCE (main track): ~6%
Security triage is one of the track's own examples, and the graph is clearly central, so this lands in the top 10–15% of perhaps 150–300 entries. To win, though, a judge has to believe the headline number. A FalkorDB engineer who asks "does a lockfile actually float?" pops the demo's main claim.

## EVIDENCE
- Shai-Hulud counts kept changing: 187 at first, then 500+, from at least 37 developers ([Ampcus](https://www.ampcuscyber.com/shadowopsintel/500-npm-packages-poisoned-in-shai-hulud-worm-attack/), [Intel 471](https://go.intel471.com/hubfs/Emerging%20Threats/2025%20Emerging%20Threats/Emerging%20Threat%20-%20NPM%20-%20Shai-Hulud%20Worm.pdf)). There is no single canonical ground-truth list, so precision and recall depend on which list you pick.
- Trusted publishing still accepts token publishes unless the maintainer turns on "disallow tokens" ([npm docs](https://docs.npmjs.com/trusted-publishers), [Evil Martians](https://evilmartians.com/chronicles/the-secure-way-to-release-an-npm-package.md)). That setting isn't visible in public registry data, so **provenance is not a barrier**.
- npm revoked all classic tokens on 2025-12-09. Logins now get 2-hour session tokens, and write tokens default to a 7-day expiry ([GitHub changelog](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/), [Oct 2025](https://github.blog/changelog/2025-10-10-strengthening-npm-security-important-changes-to-authentication-and-token-management)). The "stolen long-lived token" model behind the brief is partly out of date. Worms still happen anyway: 2026 waves include CanisterWorm and the Aug 2026 keyv wave ([CSA](https://labs.cloudsecurityalliance.org/research/csa-research-note-npm-canistersprawl-supply-chain-worm-20260/), [Sonatype](https://www.sonatype.com/blog/mini-shai-hulud-npm-attack-more-than-2200-components-impacted)).
- Socket already blocks malicious installs and comments on PRs ([Socket](https://socket.dev/pricing)). It's the incumbent judges will compare this to.
- FalkorDB has `algo.bfs`, `algo.SPpaths`/`SSpaths` and `algo.pageRank`. Its docs warn that deep BFS on dense graphs blows up exponentially ([FalkorDB algorithms](https://docs.falkordb.com/algorithms), [BFS](https://docs.falkordb.com/algorithms/bfs)).
- I found no published WeMakeDevs winner list ([WeMakeDevs Telegram](https://t.me/s/WeMakeDevs)), so there's no pattern of past winners to match.

## SIMULATION
Day 1: crawling about 10k packuments is fine. Provenance takes a second pass over per-version attestations, which is slow. CAN_PUBLISH comes from the `maintainers` field, which leaves out org/team publishers and CI tokens. Day 2: lockfile exposure works, but then the builder notices that every edge in a lockfile is already pinned. Day 3: the worm canvas is built, and features 4–5 are probably cut. Demo, shot 3: the replay seeded with a latest-version snapshot from October 2026 bears little resemblance to September 2025.

Five questions a skeptical judge would ask:
1. Your lockfile pins exact versions, so what does a floating edge mean for `npm ci`?
2. Does provenance stop a token publish? (No.)
3. Where does CAN_PUBLISH come from, and how complete is it?
4. Shai-Hulud spread through devDependencies and CI installs, so why model only runtime deps?
5. Why use this instead of Socket plus `minimumReleaseAge`?

The brief breaks on questions 1, 2 and 4.

## STEELMAN vs ATTACK
**For:** it's timely, the graph is genuinely needed, the dataset is public, it answers "who can ship code into my app," its output is an action rather than a report, and it fits the track description almost word for word.
**Against:** the model's two barriers are wrong. Floating edges don't float under a lockfile, and provenance doesn't stop a stolen token. The real exposure happens when the lockfile is refreshed, and that's handled by a release-age delay with no graph involved.

## TOP 3 FLAWS
1. **The lockfile premise contradicts itself.** The judge asks why you would pin packages the lockfile already pins. Nobody has an answer, and the "47 → 9" drop turns out to be an artifact of the model.
2. **Provenance treated as a barrier.** A security-literate judge points out that "disallow tokens" is the real control, so every "hardened" path in feature 5 is fictional.
3. **Validation backfires.** The runtime closure of the top 2,000 packages, at their current versions, barely contains the Shai-Hulud victims (small packages, CI installs). Recall comes out around 5%, and the README has to say so, as the brief promises.

## THE BEST VERSION
Change the question to: **"If I refresh my lockfile today, which accounts could ship code into it, and through which floating ranges?"** Model the publish barrier only as "unknown/token-allowed," with no provenance-as-barrier claim. Put a dated, per-version incident graph (September 2025 versions) beside the live one. Drop feature 5, and present the worm replay as an illustration rather than a validation. Include devDependencies. Make the agent's fix a ranked list of overrides plus a release-age delay, with the exposure recomputed after each one.

## VERDICT
**Build it with changes:** the graph is real, but unless the floating and provenance semantics are fixed first, the headline number won't survive the first expert question.
