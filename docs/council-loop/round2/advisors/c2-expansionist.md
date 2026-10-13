# Candidate 2 (K8s outdated-docs finder): Expansionist review

## SCORES (1–10)
- **Graph essential: 7.** The proof path (Page → Claim → FeatureGate → CHANGED in Release → KEP → Issue/SIG) is a real multi-hop join across three repositories. Without the graph, the routing and proof cards don't exist. Plain detection could still be done with grep plus a dict, so this is not a 9.
- **Demo memorability: 6.** Two moments could stick: the agent catching itself before writing a removed `apiVersion`, and "we filed this upstream". But both sit behind the day-3 cut line. The guaranteed core (cards plus a fix list) is a table-and-card demo.
- **4-day feasibility for one builder: 5.** The truth layer is cheap, because kep.yaml and the feature-gate files are structured. The git-history people layer, the backtest-by-checkout and the hand-checked precision are where days go. Six demo beats for a 4-day solo build is over-promised.
- **Originality vs competitors: 7.** Pluto already finds removed apiVersions in files, so that claim type is commodity. Swimm detects drift only for code-coupled snippets. Nothing I found routes stale prose to an owning SIG with a KEP-backed proof.
- **Real-world usefulness: 6.** SIG Docs and release-docs shadows are a real but small audience. Stale-gate bugs do get filed and fixed by hand today (e.g. website #46575).

## WIN CHANCE (Company Brain): ~8%
It fits the track well ("tracing decisions to their source", "keeping knowledge current", "who owns what", answers with sources). It uses real public data, and outside validation (upstream issues, backtest recall) is rare at hackathons. Against that: the Company Brain prize is the M6 Mac Mini, and the track will draw many generic Slack/Notion "brain" RAG apps. This entry stands out against those, but it is niche. Judges who don't know Kubernetes may not feel the pain. A secondary Track 1 entry adds maybe 2–3 points if the `is_current` guard ships.

## EVIDENCE
- Pluto detects deprecated/removed apiVersions in files and Helm releases, with CI exit codes. It does nothing with docs prose, ownership or KEPs: https://pluto.docs.fairwinds.com/ and https://www.plural.sh/blog/kubernetes-api-deprecation-tool-guide/
- The `feature-state` shortcode with `feature_gate_name` pulls its state from the gate description files, which confirms the brief's exclusion logic. The shortcode also takes a hard-coded `state`, which is exactly the target: https://kubernetes.io/docs/contribute/style/hugo-shortcodes
- Stale-gate docs are a real, hand-fixed problem: `ServiceNodeExclusion` was still mentioned years after its removal: https://github.com/kubernetes/website/issues/46575. The removed-gates reference provides ground truth: https://v1-36.docs.kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed/
- KEP metadata (owning SIG, stage milestones, gates per component) is structured and rendered: https://www.k8s.dev/resources/keps/5295
- Swimm flags outdated docs only where code elements are coupled to them: https://docs.swimm.io/features/keep-docs-updated-with-auto-sync/
- The FalkorDB MCP server exists (OpenCypher, read-only mode, HTTP or stdio), so the guard can be a thin custom tool next to it: https://mcpservers.org/servers/FalkorDB/FalkorDB-MCPServer
- I found no public list of past WeMakeDevs winning projects: https://t.me/s/WeMakeDevs. docs.falkordb.com and docs.github.com failed DNS from my sandbox, so I could not check GitHub API limits. Assume 5k req/h authenticated and prefer local `git log` over API calls.

## SIMULATION (abridged)
- **Day 1:** parse gates and KEPs. Claim extraction works.
- **Day 2:** the history-vs-current classifier and the exclusions work, but hand-labelling precision eats the evening.
- **Day 3:** `git log --follow` over roughly 1,500 pages is slow. Building PR/person edges needs mapping commits to PRs, which means hitting API limits.
- **Day 4:** polish, video and deploy. No backtest and no guard.

**Demo:** beats 1–3 land, while 4–6 are "if time". Likely skeptical-judge questions: "Isn't this Pluto plus grep?" "Did maintainers accept your issues?" "Why does the graph matter for detection?" "How fresh is the truth layer?" "Who uses this weekly?"

## TOP 3 FLAWS
1. **The wow moments are cut first.** The guard demo and the backtest are both gated to after day 3. If day 3 slips, the video is "cards and a list", indistinguishable from a careful script.
2. **Low raw finding count.** If, after exclusions, only around 10 truly stale prose claims remain, the "grep 60 vs graph 31" headline collapses into "graph found 8".
3. **Upstream issues are not a sure thing.** Duplicates or closed-as-intended responses during the event would undercut the proof story publicly.

## THE BEST VERSION
- **Promote the `is_current` MCP guard to day 2.** It is small: a Cypher lookup plus one tool. It is the most memorable beat and earns the second track. Frame it as "context for AI agents": coding agents trained on stale Kubernetes docs are a mass-market pain far bigger than SIG Docs.
- **Keep** the proof card, the SIG routing via KEP and OWNERS files, and filing 2–3 upstream issues on day 2, so maintainer responses arrive before submission.
- **Cut** the PR/person layer down to git-log authors only (no GitHub API). Make the backtest a single release diff rather than full historical replays.
- **Add** an `explain_change(gate)` MCP tool returning the KEP path, so the agent cites its source when it corrects itself.

## VERDICT
Build it with changes: reorder so the agent guard and the upstream issues ship by day 2, because they are what make this a standout rather than a niche linter.
