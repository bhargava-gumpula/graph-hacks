# Outsider review: Candidate 1, npm stolen-token exposure agent

**Plain-language read:** "Paste your lockfile and see how many strangers' npm accounts can ship code into your app. Then the agent closes most of those paths." That pitch is clear and makes people a little uneasy, which helps. It also fits the threat everyone remembers from the last year. The brief itself is dense, though. It has five features, three of them named "modes", and a judge will remember only the first two.

## SCORES (1–10)
- **Graph essential: 8.** Multi-hop reach through floating edges, minus provenance barriers, is a traversal problem. Without the graph there is no product.
- **Demo memorability: 7.** "47 accounts → 9 after the agent's fix" is a sharp before/after, and a worm spreading round by round on a canvas is easy to watch. It loses points because the numbers are placeholders, and the overlap with the real attack could turn out embarrassing.
- **4-day feasibility for one builder: 5.** Crawling 8–15k packuments, building the graph, the exposure query, the edit optimizer, worm mode, the canvas, MCP, and a live deploy is a lot. The cut line helps, but features 4 and 5 are where the story pays off.
- **Originality vs competitors: 6.** The academic result is from 2019, and vendors (Arnica, Cycode, Phoenix) already answer "am I affected?" Saying "which *accounts* can reach me, and which pins cut that" is a new framing, but it is not a new capability.
- **Real-world usefulness: 6.** Security-minded maintainers would look at it once. Most teams already get the main fix (a release-age delay) as a pnpm 11 default.

## WIN CHANCE (Agents That Act on Connected Data): ~6%
"Security triage" is one of the track's own examples, and this entry hits multi-hop reasoning, graph algorithms as agent tools, MCP, a graph-driven action, and explainable paths. That puts it in the top tier of fit. Across 100–300 submissions, though, a solo build that ships features 1–3 cleanly is maybe top 10–15. Winning takes a polished live demo plus judges not catching the modeling issues below.

## EVIDENCE
- The Zimmermann et al. paper reports that a handful of maintainer accounts could inject code into most of npm, with about 39 maintainers implicitly trusted per package: [USENIX](https://www.usenix.org/conference/usenixsecurity19/presentation/zimmerman), [arXiv](https://arxiv.org/pdf/1902.09217).
- Shai-Hulud first spread via @ctrl/tinycolor, and counts grew from 187 to 500+ packages. Wiz keeps an updated appendix that can serve as a ground-truth list: [Wiz](https://wiz.io/blog/shai-hulud-npm-supply-chain-attack), [Lumifi](https://www.lumificyber.com/threat-library/npm-package-compromise-and-ongoing-shai-hulud-worm/).
- Existing exposure tools match your inventory against a known-bad list. They do not model reach before an attack happens: [Arnica](https://www.arnica.io/blog/shai-hulud-2-0-how-to-immediately-identify-your-exposure-with-arnicas-new-sbom-view), [Cycode](https://cycode.com/blog/shai-hulud-npm-supply-chain-attack/), [Phoenix](https://phoenix.security/?p=37700).
- pnpm 11 now defaults minimumReleaseAge to 1,440 minutes, so the headline fix is already on by default for pnpm users: [Cyber Security News](https://cybersecuritynews.com/pnpm-11-turns-on-minimum-release-age/amp/), [pnpm docs](https://pnpm.io/10.x/settings).
- Provenance comes automatically with trusted publishing. Provenance on the latest version does not, by itself, stop a token-based publish: [npm provenance](https://github.com/npm/provenance), [GitHub blog](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/).
- FalkorDB documents `algo.pageRank`, `algo.SPpaths` and `algo.SSpaths` as CALL procedures, which covers reach and why_path: [FalkorDB algorithms](https://docs.falkordb.com/algorithms). (docs.falkordb.com did not resolve when I tried a direct fetch, so this comes from search snippets.)
- I found no published winners from past WeMakeDevs/FalkorDB events: [event page](https://www.wemakedevs.org/hackathons/falkordb).

## Simulation (short)
- **Day 1:** the crawl and load. Rate limits and scoped packages eat about half a day.
- **Day 2:** exposure plus cut. A naive variable-length traversal over 10k+ nodes needs the precomputed `reach` to stay fast.
- **Day 3:** worm mode plus the canvas.
- **Day 4:** deploy, video, README.
- **Where the demo breaks:** at shot 2. A judge asks "doesn't my lockfile already pin every version?"

**A skeptical judge's 5 questions:**
1. Lockfile vs. range: which one actually matters?
2. Does provenance really block a stolen token?
3. What precision and recall did the replay get?
4. Who runs this a second time?
5. How is this different from the 2019 paper plus Socket?

Questions 1 and 2 are the weak spots.

## Steelman / Attack
- **For:** It has the right villain at the right time, a real graph problem, an agent that *acts*, and an honest scope. The one-line hook is memorable.
- **Against:** The threat model is shakier than the pitch. The worm actually spread via tokens stolen from developers' machines and CI, not via dependency edges, so the replay may score poorly. The main fix is now a default setting.

## TOP 3 FLAWS
1. **Lockfile semantics are muddled.** A committed lockfile already pins exact versions. Floating ranges only matter on `npm install`/update, or when a project is used as a library. *Failure:* a judge says "my lockfile already protects me," and the 47→9 number loses its meaning.
2. **"Provenance = barrier" is wrong as stated.** A stolen token can still publish unless the maintainer has disallowed token publishing. *Failure:* a FalkorDB or security judge spots it, and the worm-stopping toggle in shot 4 looks made up.
3. **The validation may backfire.** The real infection set depended on who happened to install packages, not on graph structure. *Failure:* recall comes out around 10%, and the README states it as committed.

## THE BEST VERSION
- **Keep:** the lockfile exposure count, why_path with visible Cypher, and the agent's cut-plan PR.
- **Reframe:** call it "exposure on your next install/update." Model the barrier as "the package disallows token publish, or 2FA is required" where the data allows, and label it as an assumption.
- **Cut:** "Harden these 10."
- **Demote:** make worm validation an optional appendix.
- **Add:** a 10-second opening line that tells a non-specialist why this matters: "Shai-Hulud hit 500 packages; here's how close it got to *your* app."

## VERDICT
Build it with changes: the hook and graph fit are strong, but fix the lockfile and provenance logic before a judge does.
