# Candidate 4 (Kubernetes docs-freshness brain): Executor review

## SCORES (1–10)
- **Graph essential: 6.** The multi-hop part is real: release, then gate, then claim, then page, then linked pages, with PageRank ranking the results and a stored justification path. But a flat grep of page text against the official "feature gates removed" list catches the most obvious cases without any graph, and a judge can say so.
- **Demo memorability: 6.** "This sentence has been wrong since v1.23, and here is the changelog line that proves it" lands well. A ripple animation over thousands of doc nodes is likely to look like a hairball.
- **4-day feasibility for one builder: 6.** The inputs are public and structured (I fetched `kep.yaml`, which has owning-sig, milestones by stage and feature-gates). The breadth is the problem: 4 data sources, Hugo link resolution, claim extraction, propagation, PageRank, 3 MCP tools, a canvas, drafted fixes, a hand check of 30 pages and a deployment.
- **Originality vs competitors: 7.** Existing doc-drift tools (Codocia, DriftGuard, Pituitary, oma-docs) link docs to *code files* or specs. I found none that links docs to *release-lifecycle entities* with evidence paths, and no Kubernetes-specific checker.
- **Real-world usefulness: 6.** The pain is real and documented (see Evidence). The users are SIG Docs and SIG leads, a small, volunteer, niche audience. It generalises to any versioned product, but the brief doesn't show that.

## WIN CHANCE (Company Brain): ~6%
Track fit is strong ("keeping knowledge current", "answers with sources", "who owns what"). Upstream issues it files would be rare, real outside proof. Against it: it uses docs only, with no tickets or chats, so it is a narrow reading of "company brain". It is also infra-flavoured, and a polished Slack/Notion-style brain may read better to judges. With maybe 150 real submissions and 1 prize, a well-executed build is top-10 material. Winning needs the hand-checked precision to come out high.

## EVIDENCE
- This exact failure happens upstream. kubernetes/website#46575 found a page that still mentioned the `ServiceNodeExclusion` gate, which doesn't exist from v1.23 onward. The issue was opened in May 2024 and fixed in June 2024, so the page was wrong for about 2.5 years: https://github.com/kubernetes/website/issues/46575
- The removed-gates list is official and structured, a ready seed for "changed entities", and also the grep baseline: https://kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed/
- Feature-gate pages are generated from front matter (stage, fromVersion, toVersion). The contributor guide warns that prose elsewhere goes stale when a gate's default flips: https://v1-34.docs.kubernetes.io/docs/contribute/new-content/new-features/
- `kep.yaml` structure (milestone alpha/beta/stable, feature-gates, owning-sig): https://raw.githubusercontent.com/kubernetes/enhancements/master/keps/sig-node/753-sidecar-containers/kep.yaml
- FalkorDB `CALL algo.pageRank(label, relType) YIELD node, score` is confirmed and can be limited to a label and relationship type: https://docs.falkordb.com/algorithms/pagerank.html
- Prior art (doc-to-code drift only): DriftGuard https://lablab.ai/ai-hackathons/ibm-bob-hackathon/team-said/driftguard-ai-doc-drift-detection-engine, Codocia https://docs.rs/crate/codocia/latest, Pituitary https://dusk.network/news/pituitary
- I found no published WeMakeDevs graph-hackathon winners to calibrate against. A search result for the event page carried an older-looking "Next-Gen RAG / $10k" title. Check track names on the official /rules page before submitting: https://www.wemakedevs.org/hackathons/falkordb/rules

## SIMULATION (where it breaks)
- **Day 1:** ingest about 700 KEPs and the English pages, and extract mentions with regexes. This breaks on Hugo `{{< ref >}}`, `glossary_tooltip` and relative links, so LINKS_TO comes out half-empty.
- **Day 2:** release changes. Parsing CHANGELOG Markdown is messy. Deriving changes from gate front matter, KEP milestones and the removed list works. Claude claim extraction also happens on day 2.
- **Day 3:** propagation Cypher, PageRank, the MCP tools and the UI. The canvas eats the day.
- **Day 4:** the hand check of 30 pages (about 3 hours if done honestly), the video, the tunnel and the README. There is no slack left.
- **Demo risk:** for the *latest* release, docs PRs ship together with the release, so the newest changes may show few stale pages. The juicy hits are long-tail gates from 3 to 10 releases back.
- **Judge questions:**
  1. Why not just grep for removed gate names?
  2. What's your precision?
  3. How do you tell a historical mention ("beta in v1.27") from a false claim?
  4. Does it work beyond Kubernetes?
  5. What does FalkorDB do that a SQL join wouldn't?

  Questions 1 and 3 are the dangerous ones.

## STEELMAN / ATTACK
- **For:** the data is real and public, ingestion is mostly deterministic, LLM cost is tiny, the evidence chains are explainable, a real upstream issue makes powerful outside proof, and the "truth maintenance" framing is clever.
- **Against:** the "graph" value over a grep is thin unless link propagation and per-claim reasoning are shown to matter. False positives from historical mentions could tank precision. The scope is about 1.5x what one person can polish in 4 days.

## TOP 3 FLAWS
1. **The grep baseline undercuts "graph essential".** A judge greps for `ServiceNodeExclusion`, finds the same page and concludes the graph is decoration.
2. **Precision collapse.** Pages such as "feature gate X went GA in 1.29" are historically true but get flagged. The hand check comes out at 40% precision, and the headline number becomes a liability.
3. **Scope sprawl.** Day 4 arrives with a broken link graph, a half-working canvas and no hand check, and the demo has nothing to show.

## THE BEST VERSION
- **Cut:** CHANGELOG parsing, drafted fixes, `is_current` free-form Q&A and the ripple-by-ripple animation. Use a static evidence-path view instead.
- **Keep:** KEPs, gate front matter and the removed list as the source of truth; MENTIONS and LINKS_TO; PageRank; the per-SIG list; the `why_stale` path; 2 MCP tools.
- **Add:**
  - Parse the `{{< feature-state for_k8s_version state >}}` shortcode as a deterministic claim (free and precise), and use Claude only to classify a mention as historical or current.
  - Lead the demo with a side-by-side "grep finds N, graph finds N + linked-page and claim-level hits, with paths".
  - Run the system against an older release and show that it re-finds issue #46575.
  - File 1 or 2 real upstream issues by Thursday.

## VERDICT
Build it with changes: halve the scope, make claims deterministic, and prove the graph beats grep on screen.
