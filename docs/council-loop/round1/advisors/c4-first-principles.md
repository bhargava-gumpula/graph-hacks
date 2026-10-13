# Candidate 4: Kubernetes docs staleness brain (First Principles advisor)

**The underlying problem:** a release changes the state of some named entities (feature gates, API versions, flags). Prose that states the old state is now wrong. Someone has to find those sentences, rank them, and get them to the people who own them.

**Does the problem need a graph?** Only in part. The first hop (release, then changed gate, then pages that mention it) is a set intersection: take the changelog's changed names and grep `content/en` for them. A shell script does that, and it is most of the true positives. The graph-shaped parts are what comes after: ownership routing (Page to SIG), PageRank over the link graph, second-hop propagation through LINKS_TO, KEP SUPERSEDES chains, and a stored justification path for each flag. Those parts are real, but they are also the weakest signals.

## SCORES (1–10)
- **Graph essential: 6.** Take FalkorDB out and you keep about 70% of the value through grep plus a dict. The graph earns its place in the ranking, the routing and the "why" paths, not in detection.
- **Demo memorability: 6.** A ripple from the release to claims to pages, then one highlighted sentence linked to its changelog line, is concrete and easy to read. A hand-checked precision number is rare and persuasive. It still looks like a linter report with a canvas.
- **4-day feasibility for one builder: 6.** The parsing is the risk, not the graph. Changelogs are free-form Markdown, regexes for gate names collide with ordinary words and code, and the `kep.yaml` template has no `superseded-by` field (only `replaces`), so one edge in the model rests on a misreading. The hand-validation of 30 pages costs half a day.
- **Originality vs competitors: 6.** Doc-drift tools exist for code-to-doc drift (Swimm, Falconer, a lablab "DriftGuard" hackathon project, a Claude Code detect-doc-drift skill). Release-to-prose drift with justification paths is less common, and truth maintenance as a framing is classic rather than new.
- **Real-world usefulness: 6.** The pain is real (removal PRs routinely need a follow-up website PR). But Kubernetes already partly solved it at the source: the `feature-state feature_gate_name=` shortcode pulls a gate's stage from front matter, and removed gates move pages automatically. What remains is free prose, which is exactly the part only Claude extraction can catch.

## WIN CHANCE (Company Brain): about 8%
It is a disciplined, honest and validated entry in a field of perhaps 100–300 real submissions. But "Company Brain" judges are likely to picture docs plus tickets plus chats plus people. This idea uses one corpus and one kind of change, and its "who knows what" is an OWNERS file lookup. Above average, not a favourite.

## EVIDENCE
- The Kubernetes docs already derive feature state from front matter (`stages`, `fromVersion`/`toVersion`, `removed: true`) and the `feature-state` shortcode: [Documenting a feature for a release](https://www.kubernetes.io/docs/contribute/new-content/new-features/), [Custom Hugo shortcodes](https://v1-36.docs.kubernetes.io/docs/home/contribute/includes/)
- Gate removals require manual follow-up website PRs: [kubernetes/kubernetes#116255](https://github.com/kubernetes/kubernetes/issues/116255), [feature gates removed](https://kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed)
- The `kep.yaml` template has `stage`, `milestone`, `feature-gates` and `replaces`, but no `superseded-by`: [KEP template](https://github.com/kubernetes/enhancements/blob/master/keps/NNNN-kep-template/kep.yaml)
- FalkorDB `CALL algo.pageRank(label, relType) YIELD node, score` is confirmed: [FalkorDB PageRank](https://docs.falkordb.com/algorithms/pagerank)
- Prior art on doc drift: [Unblocked roundup (Swimm and others)](https://getunblocked.com/blog/best-ai-documentation-tools-engineering-teams/), [Falconer](https://falconer.com/guides/docs-as-code/), [DriftGuard on lablab](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/team-said/driftguard-ai-doc-drift-detection-engine), [provgraf, staleness propagation for agent facts](https://glama.ai/mcp/servers/Inarus/provgraf)
- Truth maintenance lineage: [McAllester, AAAI-90](https://cdn.aaai.org/AAAI/1990/AAAI90-164.pdf)
- No past winners have been published for a WeMakeDevs graph hackathon: [event site](https://www.wemakedevs.org/hackathons/falkordb)

## Simulation
- **Days 1–2:** KEP and OWNERS ingestion works. Parsing the changelog into CHANGES edges eats a day, because entries are prose. Page MENTIONS via regex is quick, but gates like `Sidecar` or `DryRun` produce noise.
- **Day 3:** claim extraction, propagation and PageRank all work. The canvas ripple takes longer than expected.
- **Day 4:** hand-validation, drafts and the video. Deployment gets squeezed.
- **Judge questions:** (1) "Isn't this grep?" This is the weak point. (2) "Doesn't the feature-state shortcode already do this?" (3) "What precision did the second hop through links get?" Probably low. (4) "Where's the company brain beyond docs?" (5) "Did you file a real upstream issue?" A strong yes if it was done.

## Steelman / attack
- **For:** it has a real, checkable, public outcome, and every flag carries a provenance path. The measured precision and any upstream issue filed are outside proof most entries lack. It is cheap on API spend.
- **Against:** the graph's work sits in the low-value hops. The high-value hop is a join. Kubernetes has already automated the structured part.

## TOP 3 FLAWS
1. **The "it's grep" collapse.** A judge asks what the graph detects that grep plus OWNERS doesn't. The honest answer is "ranking and LINKS_TO hops," and those hops give the most false positives.
2. **Weak precision from second-hop propagation.** Pages that link into a stale page are rarely stale themselves. The top-30 check shows something like 40% precision on second-hop flags and undermines the headline.
3. **Track fit.** Company Brain asks for docs, tickets and chats, and for who knows what. One docs corpus with OWNERS-file ownership reads as narrow.

## THE BEST VERSION
- **Cut:** drafted fixes and second-hop link propagation as a headline. Keep the second hop only as low-confidence context.
- **Keep:** the claim-level flags with paths, PageRank plus SIG routing, measured precision, and the MCP tools.
- **Add:** GitHub issues and PRs from kubernetes/website and kubernetes/kubernetes as nodes (open "outdated docs" issues and the PRs that removed each gate). This adds tickets and people for "who knows what": route each stale page to the PR author who removed the gate. Show a baseline: grep finds N, the graph adds M ranked and routed with reasons. Report precision separately for each hop.

## VERDICT
**Build it with changes.** The problem is real and verifiable, but the graph has to be shown doing more than a join: add issue and PR provenance and people routing, and report each hop's precision against a grep baseline.
