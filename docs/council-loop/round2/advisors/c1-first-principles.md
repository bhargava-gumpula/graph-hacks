# First Principles advisor: candidate 1 (npm stolen-token exposure agent)

**The underlying problem.** A project runs code from hundreds of strangers. When one of them loses a publish token, the project picks up the malicious release on its next dependency resolution. The defenses that address this directly are: (a) don't resolve new versions blindly (a lockfile plus `npm ci`), (b) wait before installing fresh releases (pnpm `minimumReleaseAge`, on by default at 1 day in pnpm v11), and (c) refuse trust downgrades (pnpm `trustPolicy: no-downgrade`). These are one-line config changes and need no graph. So the per-project feature is mostly a graph-shaped explanation of a problem a config flag already fixes. The ecosystem question ("which accounts or packages, if hardened, stop a worm") is where traversal really matters.

## SCORES (1–10)
- **Graph essential: 6.** Worm contagion and "harden these 10" need multi-hop traversal. But a `package-lock.json` already contains the resolved tree, so "who can ship into this app" is mostly a flat join from lockfile packages to maintainers. The graph adds only the floating-edge filter.
- **Demo memorability: 6.** "47 accounts can ship into this app" and a round-by-round worm replay make a strong opening. The weak spot is the reality-overlap shot, which may show close to zero recall.
- **4-day feasibility: 5.** Crawling 8–15k packages with maintainers, ranges and attestations in one day is doable. Feature 1 to 3 plus a canvas, the MCP tools and a live deployment fill all four days, and features 4 and 5 will probably be cut.
- **Originality: 5.** Zimmermann et al. (USENIX 2019) measured maintainer reach. A hosted "Blast Radius" tool already takes a lockfile and returns the paths to a compromised package. Socket flags compromised maintainers. The worm and provenance layer is new, but it is incremental.
- **Real-world usefulness: 5.** Security teams care about this. Their first action, though, is a release-age cooldown, which the tool itself recommends. Pinning transitive dependencies via `overrides` blocks security patches and goes stale, so few teams would merge that PR.

## WIN CHANCE: ~5% (Agents That Act on Connected Data)
Security triage is literally a listed example for this track. The subject is topical (two Shai-Hulud waves, the second in Aug 2026), and the brief is honest about its scope. Against that: I expect several supply-chain or dependency-graph entries among 100–300 submissions, and the "action" amounts to config any judge can name without a graph. I put it above the base rate of about 1–2%, but not by much.

## EVIDENCE
- The waves were large and spread through the long tail: 500+ packages in Sept 2025 (@ctrl/tinycolor, CrowdStrike packages) ([Ampcus](https://www.ampcuscyber.com/shadowopsintel/500-npm-packages-poisoned-in-shai-hulud-worm-attack/), [Cycode](https://cycode.com/blog/shai-hulud-npm-supply-chain-attack/)), and 1,300+ versions in 2026 (keyv, flat-cache) ([CSA SG](https://csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009), [Socket list](https://socket.dev/supply-chain-attacks/keyv-and-cacheable-compromise)).
- Prior art on maintainer reach: [Small World with High Risks summary](https://blog.acolyer.org/2019/09/30/small-world-with-high-risks/), [USENIX slides](https://www.usenix.net/sites/default/files/conference/protected-files/sec19_slides_zimmermann.pdf). An existing lockfile blast-radius tool: [Blast Radius](https://blast-radius-web-zc8b.onrender.com/) (I could not verify its claims because the fetch failed). [Socket features](https://www.socket.dev/features).
- The fixes already exist: pnpm `minimumReleaseAge` and `trustPolicy: no-downgrade` ([Supabase npm security guide](https://supabase.com/docs/guides/security/npm-security.md)). Trusted publishing generates provenance automatically ([npm docs](https://docs.npmjs.com/trusted-publishers)).
- FalkorDB supports `algo.pageRank`, `algo.SPpaths` (with maxLen and relTypes) and an MCP server via `npx @falkordb/mcpserver` ([procedures](https://docs.falkordb.com/cypher/procedures.html), [SPpaths](https://docs.falkordb.com/algorithms/sppath.md), [MCP quickstart](https://new.docs.falkordb.com/genai-tools/mcpserver/quickstart.md)).
- The npm registry rate-limits anonymous clients (expect 429 responses). `_npmUser` identifies the publishing account ([npm.report notes](https://next.tangled.org/philippeserhal.com/npm.report)).
- I found no published winners from WeMakeDevs' earlier FalkorDB event ([event page](https://www.wemakedevs.org/hackathons/falkordb)).

## SIMULATION (where it breaks)
- **Day 1:** the crawl hits 429s and attestation fields are inconsistent, so the load finishes late.
- **Day 2:** writing exposure as Cypher shows that a lockfile project is not exposed until it re-resolves, so the headline number needs a careful definition.
- **Day 3:** canvas plus worm mode.
- **Day 4:** deployment and video, with features 4 and 5 cut.

Five questions a skeptical judge would ask:
1. "My lockfile pins exact versions, so why am I exposed?"
2. "Why not just set a 7-day cooldown?" The tool's own top recommendation concedes the point.
3. "Does provenance actually stop a stolen token?" It does not, unless token publishing is disallowed or consumers enforce no-downgrade, so the barrier assumption is wrong as modeled.
4. "Shai-Hulud spread via any install, dev dependencies included, onto developer machines. Why would a runtime closure of the top 2,000 packages predict it?"
5. "What does the graph do that a SQL join over the lockfile can't?"

## TOP 3 FLAWS
1. **The validation will embarrass the model.** Victims were long-tail packages outside the top-2,000 runtime closure, and the worm spread through developer installs, not dependency edges. Expect recall near 0%, reported prominently in the README.
2. **The headline metric misreads lockfiles.** A judge who knows npm says "`npm ci` makes that 47 equal 0 until I update." That undermines the main feature in the first 20 seconds of the demo.
3. **The proposed action is the wrong fix.** `overrides` pins freeze vulnerable versions. The real fix (a cooldown plus no-downgrade) needs no graph, so it fails the rule that the product should stop working without FalkorDB.

## THE BEST VERSION
Recenter on the ecosystem graph, where traversal is irreducible:
- **Keep:** worm mode and "harden these 10".
- **Redefine exposure as "exposure at next update / Dependabot bump",** and model provenance as a barrier only for consumers who use no-downgrade.
- **Make the agent's action** "which 10 maintainers or packages to harden, and the drop in reach," not lockfile pins. The per-project view stays as a secondary lens.
- **Replace the precision/recall promise** with "explains why the real seed reached what it did."
- **Cut** the override PR generator.

## VERDICT
Build it with changes: the graph-native core (worm reach and hardening priority) is sound, but the lockfile-pinning "action" solves a problem a one-line cooldown already solves, and that should not be the headline.
