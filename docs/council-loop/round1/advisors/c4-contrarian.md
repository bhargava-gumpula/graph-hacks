# Contrarian review: candidate 4, the Kubernetes "knowledge freshness" brain

## SCORES (1–10)
- **Graph essential: 7.** Multi-hop propagation (Release → Gate → Claim → Page → linked Page) with a stored justification path is real graph work, and PageRank runs natively (`algo.pageRank`). But the first hop, "page mentions a changed gate", is a grep, so most of the value works without the graph.
- **Demo memorability: 5.** A ripple across a docs graph looks good for 20 seconds. The payoff ("this sentence says beta, it is GA now") is dry and only lands with people who already care about Kubernetes docs.
- **4-day feasibility for one builder: 5.** Parsing kep.yaml is easy. Extracting claims from Hugo Markdown full of shortcodes and includes, handling versioned docs, and hand-checking 30 pages for precision is a lot for Thu/Fri.
- **Originality vs competitors: 6.** Generic doc-drift tools exist (code-to-doc diffing, link checkers, CI Claude actions), but I found none that frames release-driven staleness as truth maintenance over a dependency graph.
- **Real-world usefulness: 4.** Kubernetes has already automated the most mechanical part, and its release process already requires a docs PR for each enhancement. The remaining audience is small.

## WIN CHANCE (Company Brain): ~6%
It is more thoughtful than most entries and fits "keeping knowledge current / answers with sources" very well. But Company Brain judges will expect docs, tickets and chats about people and ownership. This entry is a single-corpus docs linter in "brain" clothing, with no tickets or chats and no "who knows what" beyond OWNERS files. Among about 150 real submissions, a polished, sourced and validated entry might reach the top 10. Taking the track is a long shot.

## EVIDENCE
- **The core premise is partly pre-solved upstream.** The `feature-state` shortcode has a `feature_gate_name` parameter that reads the state "dynamically" from the gate's description file, so status banners update themselves ([raw shortcode doc](https://raw.githubusercontent.com/kubernetes/website/main/content/en/docs/contribute/style/hugo-shortcodes/index.md), [kubernetes.io page](https://kubernetes.io/docs/contribute/style/hugo-shortcodes)). The gate tables and the "removed gates" page are also maintained per release ([v1.36 feature gates](https://v1-36.docs.kubernetes.io/docs/reference/command-line-tools-reference/feature-gates/), [removed](https://v1-36.docs.kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed/)). What is left is stale free prose, which is the hard and LLM-dependent part.
- **A process already exists.** Each tracked enhancement is asked for a k/website docs placeholder PR before docs freeze ([features.k8s.io/2053](https://features.k8s.io/2053), [enhancements#4008](https://redirect.github.com/kubernetes/enhancements/issues/4008)).
- **kep.yaml is less reliable than the brief assumes.** The template has `replaces` and `see-also` but no `superseded-by` field ([KEP template](https://raw.githubusercontent.com/kubernetes/enhancements/master/keps/NNNN-kep-template/kep.yaml)), and release teams have to chase owners to update KEP status after GA ([enhancements#3136](https://features.k8s.io/3136)). An unreliable source graph produces confident false flags.
- **Prior art:** doc-drift detectors that map code to docs ([borghei doc-drift-detector](https://skillselion.com/skills/borghei/claude-skills/doc-drift-detector)), CI drift checks ([understandingdata](https://understandingdata.com/posts/doc-drift-detection-ci/)). They are generic, with no release-dependency graph.
- **FalkorDB support:** PageRank is supported via `CALL algo.pageRank(label, rel)` ([docs](https://docs.falkordb.com/algorithms/pagerank)), and there is an official MCP server with `query_graph` ([docs](https://docs.falkordb.com/genai-tools/mcpserver)).
- **No past winners found** for WeMakeDevs × FalkorDB ([event site](https://www.wemakedevs.org/hackathons/falkordb)).

## Simulation
- **Day 1:** KEP and changelog ingest works.
- **Day 2:** the Markdown parser struggles with shortcodes, `{{< glossary_tooltip >}}`, includes and version-gated text, and gate names collide with plain words (e.g. "Sidecar…").
- **Day 3:** Claude claim extraction, propagation and the UI.
- **Day 4:** the hand-check comes back with weak precision, and the README must report it.

**Demo:** the ripple is fine, then the top page turns out to be the gate reference table that is already auto-updated, or a blog post (blogs are *supposed* to be historical).

**A judge's questions:**
1. "Doesn't `feature_gate_name` already solve this?"
2. "What is the precision?"
3. "Does it still work without the LLM?"
4. "Who on SIG Docs asked for this?"
5. "Where are the tickets and chats for Company Brain?"

Questions 1, 4 and 5 hurt.

## Steelman / attack
**For:** the theme is a perfect fit ("keeping knowledge current" with "why" paths), it uses fully public real data, the precision number is validated, and an upstream issue would be genuine outside proof. Truth maintenance is an intellectually crisp framing.

**Against:** the most mechanical staleness is already automated upstream, and what remains is fuzzy prose where precision will be poor. Blog posts and versioned snapshots are stale by design, so they will flood the results with false positives. The only realistic user (SIG Docs) already has a release process.

## TOP 3 FLAWS
1. **The premise is already automated upstream.** Failure scenario: the top flags are pages that use `feature-state feature_gate_name=`, which render correctly. A FalkorDB/Kubernetes-savvy judge points this out and the entry loses its credibility.
2. **Low precision from regex mentions plus unreliable kep.yaml data.** Failure scenario: the hand-check shows 30–40% precision because historical blog posts, "since v1.x" phrasing and version-pinned text all count as stale. Publishing that number undercuts the demo.
3. **Weak track fit and a narrow audience.** Failure scenario: Company Brain judges compare it with entries that unify Slack, tickets and docs with ownership, and this reads as a niche docs linter for one OSS project.

## THE BEST VERSION
- **Cut:** blog posts, the reference tables generated from gates, and any text that already uses `feature_gate_name`. Detect those pages and *exclude* them explicitly as "auto-maintained". That shows real understanding.
- **Keep:** propagation with stored paths, the PageRank-ranked fix list per SIG, and `why_stale`.
- **Add:** GitHub issues and PRs from k/website and k/enhancements as the "tickets" (who changed what, and the decision trail), so it is a genuine Company Brain. Report precision on a fixed set and file 2–3 real upstream issues before the deadline as proof.

## VERDICT
Build it with changes: it is viable only if it targets the prose that upstream automation misses, adds k/website issues and PRs as tickets, and ships a precision number it isn't embarrassed by. As briefed, it risks a judge pointing out that Kubernetes already solved the easy half.
