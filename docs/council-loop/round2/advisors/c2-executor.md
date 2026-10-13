# Executor review: Candidate 2, a Kubernetes outdated-docs finder

**Lens:** can one builder directing Claude Code agents ship this and demo it by Sat Oct 18, 11:29 AM PT, and where does it break?

## SCORES (1–10)
- **Graph essential: 6.** The proof path (Page→Claim→Gate→Release→KEP→Issue) and the fix routing (KEP→SIG, Page←PR←Person) are real multi-hop joins. Still, the core "stale" test is one join between claims and a gate-stage table. A judge could fairly say that part is a Python dict lookup.
- **Demo memorability: 6.** The card that says "docs say beta, truth says removed" and the Claude Code self-correction are both clear. Six beats in two minutes is too many, and the most memorable beats (backtest, `is_current`) sit below the cut line.
- **4-day feasibility: 5.** The core (truth layer, claim extraction, contradictions, cards) is doable. The full brief is about two weeks of work. Git-blame dating, the reviewer/PR layer, the backtest, the MCP guard and upstream filings all stack up on day 3–4.
- **Originality: 6.** Pluto already flags removed apiVersions in static manifests, and generic doc-drift tools exist. Grounding each finding in KEPs and SIG ownership for a specific public corpus is new as far as I can find.
- **Real-world usefulness: 6.** SIG Docs and the release-docs shadows are real users. I found no dedicated "outdated" issue stream to show demand, though, so the usefulness rests on the backtest, which may never be built.

## WIN CHANCE (Company Brain): ~8%
With 100–300 real submissions, a working, deployed project with real data and an outside measurement is top-decile. The project fits Company Brain on "keeping knowledge current" and "answers with sources", but it has no chats and only a thin ticket layer. If upstream issues get filed and a measured precision number is reported, the chance is about 12%. If it ships only the core, about 5%.

## EVIDENCE
- The feature-gate files have clean, machine-readable truth: `stages[{stage, fromVersion, toVersion}]` plus `removed: true` (for example [AppArmor.md](https://raw.githubusercontent.com/kubernetes/website/main/content/en/docs/reference/command-line-tools-reference/feature-gates/AppArmor.md)). Day 1 for gates is low-risk. **APIVersion removals are not in these files.** They need a hand-built table from the deprecation guide.
- Prior art: [Pluto](https://www.fairwinds.com/blog/kubernetes-easily-find-deprecated-api-versions-with-pluto) and [kubent](https://www.plural.sh/blog/kubernetes-api-deprecation-tool-guide/) already detect removed apiVersions. The manifest claim type is therefore table stakes, and a judge may ask "why not just run Pluto?" Generic drift tools include [DriftGuard (a hackathon entry)](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/team-said/driftguard-ai-doc-drift-detection-engine), [Doc Drift Detector](https://skillselion.com/skills/borghei/claude-skills/doc-drift-detector) and [Falconer](https://falconer.com/guides/sync-documentation-code-changes/).
- A [search of kubernetes/website issues](https://github.com/kubernetes/website/issues?q=is%3Aissue+outdated+feature+gate+removed) for outdated docs about removed gates returns only 4 issues, all of them localization issues. The `(:Issue)-[:REPORTS]->(:Page)` layer will be nearly empty for English, which weakens demo beat 3.
- FalkorDB has an [MCP server](https://docs.falkordb.com/genai-tools/mcpserver) (stdio/HTTP, read-only mode) and implements a [subset of OpenCypher](https://new.docs.falkordb.com/cypher). The `is_current` tool is cheap to wrap. Avoid Neo4j-only procedures. (docs.falkordb.com failed DNS once from my sandbox. Have a fallback ready.)
- The [GitHub REST limit is 5,000/hr with a token](https://docs.github.com/en/enterprise-cloud%40latest/rest/using-the-rest-api/rate-limits-for-the-rest-api). Fetching reviewers for thousands of website PRs takes hours. Authors from local `git log` cost nothing.
- I found no published winners from the [previous WeMakeDevs × FalkorDB Graph Hacks](https://www.wemakedevs.org/hackathons/falkordb). The FalkorDB SF hackathon was [won by a project that made graph nodes carry meaning](https://www.plushcap.com/content/falkordb/blog/falkordb-memory-meets-motion-the-falkordb-standouts).

## Simulation, briefly
Day 1: parse about 700 gate files and KEP yaml (fine). Extract claims from about 1,500 Markdown pages: shortcodes and fenced YAML are easy; matching gate names in sentences is noisy (`AppArmor` is also a normal word). Day 2: "written before the change" needs `git blame` per claim line, which is slow on a repo with this much history but feasible locally. The Claude classification is cheap. Day 3: people via git log, SIG via OWNERS (which are often owned by sig-docs, not the feature SIG), proof cards, deployment. Day 4: the backtest means re-extracting at an old commit and matching later diffs to the same claim, a full second pipeline. It will not happen. Skeptical judge: "Why not Pluto plus grep?" "What is your precision?" "How do you date a claim?" "Is the graph more than one join?" "Did any maintainer accept a fix?" The last two are the weak spots.

## TOP 3 FLAWS
1. **Scope overflow.** By Friday night the backtest is half-built, the README numbers are still placeholders, and the video shows four of six beats.
2. **The ticket/people layer is thin.** OWNERS resolves to sig-docs approvers, and the English "outdated" issues are close to zero. On camera, the routing card shows the same three docs approvers for every finding, and "routes to the person who can fix it" falls flat.
3. **Upstream filings depend on maintainers.** Issues filed Thursday get no triage before Saturday, so the "outside proof" is just links to unanswered issues.

## THE BEST VERSION
Keep: the gate truth layer, shortcode and sentence claims, the Claude history/current classifier, the grep-vs-graph precision table, and proof cards. **Promote the `is_current` MCP guard into the core build** (half a day, the best demo beat, and it covers Track 1). Route through the KEP's owning SIG and recent page editors from local git only. Cut: the PR reviewer API crawl, the existing-issue layer and the backtest. Replace the backtest with a cheap "release-diff" view: "v1.33 removed 12 gates → 40 pages still mention them". File 2 issues on Wednesday, not Thursday.

## VERDICT
Build it with changes: ship the gate-only core plus the `is_current` guard by day 3, and drop the backtest and the reviewer and issue layers, or the demo will be all placeholders.
