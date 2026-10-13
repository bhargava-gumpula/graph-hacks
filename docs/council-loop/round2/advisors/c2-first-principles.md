# First Principles review: Candidate 2 (Kubernetes outdated-docs finder)

**The problem underneath:** a docs page states something about a feature or API version, and that statement no longer matches what the project actually ships. Someone has to (a) notice, (b) believe it, and (c) fix it. The brief covers all three: detection, proof and routing. From first principles, though, step (a) is a **lookup**. Take claims like (gate X, stage beta) or (apiVersion Y) and check them against a table of (gate or API version, release, new state). That is a join, not a traversal. The proof card (Page → Claim → Gate → Release → KEP → Issue) is a fixed chain of foreign keys that five SQL joins can follow. The parts that really need a graph are routing (who has touched this page, which SIG owns this KEP, is there already an issue for it) and impact (which other pages link to or depend on a stale one). The brief demotes impact to "at risk context". In other words, it puts most of its weight on the part where a graph adds the least.

## SCORES (1–10)
- **Graph essential: 5.** If FalkorDB is swapped for SQLite plus a feature-gate dict, detection and proof cards still work. Only owner routing and link impact really use graph structure.
- **Demo memorability: 6.** "grep 60 → graph 31, with proof" and Claude Code fixing a removed `apiVersion` are concrete. But stale docs are a quiet problem, and the numbers are placeholders.
- **4-day feasibility: 6.** Deterministic claim extraction and KEP YAML parsing are tractable. Per-line "claim written before change" needs git blame across roughly 1,500 pages, the backtest needs a second full pipeline run at an old commit, and upstream PRs need maintainer response time the builder doesn't control.
- **Originality: 6.** Doc-drift tools exist (DriftGuard, Codocia, Autohand) and Pluto already catches removed `apiVersion`s. Tying findings to the owning KEP, SIG and editors is a new combination.
- **Real-world usefulness: 6.** SIG Docs has a real backlog (umbrella issue #56426 is still untriaged). But the bottleneck there looks like reviewer bandwidth, not detection, and outside Kubernetes nobody adopts it.

## WIN CHANCE (Company Brain): ~7%
It is better grounded than most entries: real public data, real outcomes, an upstream issue. That lifts it above the field base rate of 1/150. But judges who apply the "remove FalkorDB" test will see a lookup engine with a graph wrapped around it. Company Brain also asks for "chats" and "who knows what", and this covers that only partially.

## EVIDENCE
- `feature_gate_name` already pulls the badge state from the gate description files, and `state` is a manual override. So the target is real but narrower than it sounds: [Hugo shortcodes](https://kubernetes.io/docs/contribute/style/hugo-shortcodes).
- Removed gates are "no longer recognized", so the truth source is clean: [feature-gates-removed](https://kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed/).
- Pluto already finds deprecated or removed apiVersions in files, without a graph: [Pluto docs](https://pluto.docs.fairwinds.com/), [Fairwinds blog](https://www.fairwinds.com/blog/kubernetes-easily-find-deprecated-api-versions-with-pluto).
- Prior art on doc drift: [DriftGuard (hackathon)](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/team-said/driftguard-ai-doc-drift-detection-engine), [Codocia](https://docs.rs/crate/codocia/latest), [Autohand docs drift](https://docs.autohand.ai/guides/maintaining-documentation).
- The demand signal is real but modest: [kubernetes/website issues](https://github.com/kubernetes/website/issues?q=is%3Aissue+outdated+feature+gate) shows 11 hits, including #41379 (gates wrongly marked beta, since fixed) and #56426 (an untriaged umbrella issue).
- The official FalkorDB MCP server (OpenCypher, read-only mode) exists, but `is_current` would be a custom tool anyway: [FalkorDB-MCPServer](https://glama.ai/mcp/servers/FalkorDB/FalkorDB-MCPServer).
- Past FalkorDB/WeMakeDevs winners aren't published, so there is no pattern to copy: [event page](https://www.wemakedevs.org/hackathons/falkordb).

## SIMULATION
Day 1: parse gates, KEPs and pages. This is fine. Day 2: claim extraction plus Claude history-vs-current classification. Gate-name mentions inside prose are noisy (`SidecarContainers` vs "sidecar containers"). Day 3: git history for people and PRs, then the cards. The GitHub API rate limit (5k/hr) is fine, but slow PR-to-page mapping eats the day. The backtest and `is_current` are probably cut, and those are the two most memorable demo shots. Skeptical judge: "Why not a Python dict?" (weak answer). "How is this different from Pluto?" "What's the precision?" "Did maintainers accept your issue?" (unknown by Oct 18). "Where's the agent?" (cut).

## STEELMAN / ATTACK
**For:** real public data, a provable ground truth, falsifiable metrics against a baseline, and outside validation. It is rare honesty for a hackathon. **Against:** the core value is a set-difference query, and the graph mostly does storage and display. The flashiest parts sit below the cut line.

## TOP 3 FLAWS
1. **The graph is a join engine.** A FalkorDB judge asks "show me a query only a graph could answer", and the strongest one is a 6-hop path that is a straight foreign-key chain.
2. **The demo payoff sits below the cut line.** If day 3 slips, the video shows a list of flagged pages and some cards, with no agent and no backtest.
3. **The finding count may be small.** After excluding auto-maintained badges, reference pages and blogs, real stale claims could number in the low dozens, and mostly apiVersions that Pluto already catches. Then the "graph beats grep" slide comes out weak.

## THE BEST VERSION
- **Cut:** the full backtest. Replace it with 3–5 hand-picked historical fixes.
- **Keep:** the truth layer, deterministic claims, the grep baseline and one upstream issue.
- **Promote:** `is_current` to day 2. It is the Track 1 hook and the only "agent" in the build.
- **Add real graph work:** stale-impact propagation (page includes and links, gate dependencies, API version → Kind → every page and tutorial using it). Also add owner ranking by traversal or PageRank over Person–PR–Page–SIG, so routing is a computed answer and not a lookup.

## VERDICT
Build it with changes: the problem is real and measurable, but move the graph's work from looking up staleness to propagating impact and ranking owners, and pull the agent guard above the cut line.
