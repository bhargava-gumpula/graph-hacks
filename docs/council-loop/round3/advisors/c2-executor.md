# Executor review: candidate 2, Kubernetes "version truth" MCP and stale-docs ranking

## SCORES (1–10)
- **Graph essential: 5.** `is_current` checks an apiVersion against a removal release, which is a lookup table. Pluto already does exactly this with `--target-versions`. The graph only earns its place in the day-3 include/link propagation and in KEP provenance, and that part is secondary in the pitch if findings are scarce.
- **Demo memorability: 5.** "Agent writes a removed API, the hook catches it" is clear but has to be staged. Current Claude models usually write `batch/v1` CronJobs and `autoscaling/v2` HPAs correctly, so the builder will probably have to prompt for a stale target or seed the mistake, and judges notice that. The "one example lights up many pages" view is the only visual payoff.
- **4-day feasibility: 6.** Every source is public, structured and deterministic: the deprecation guide, the feature-gate description files, `kep.yaml`, the `code_sample` includes and OWNERS. That is ETL work that agents handle well. But it is two products (an agent guard and a docs-impact ranker) with about five parsers (Hugo shortcodes, inline YAML, KEP YAML, OWNERS, git log on a very large repo), so day 3 is overloaded.
- **Originality: 5.** Deprecation detection is solved: Pluto handles static manifests and Helm, and kubent handles live clusters. A version-aware K8s MCP server already exists (kubernetools). Ranking docs fixes by include fan-out is the new angle, but it serves a niche audience.
- **Real-world usefulness: 5.** The guard is useful, but Pluto in CI already covers it without an LLM. The docs ranking serves perhaps a few dozen SIG Docs maintainers, and the versioned K8s docs probably contain few truly stale current-version examples.

## WIN CHANCE (Agents That Act on Connected Data): ~4%
The core is competent and explainable, with an MCP tool, a provenance path and a real traversal. But 100–300 submissions will include many flashier fraud and security graphs, and a judge who knows Pluto will see the headline feature as a known tool with a graph wrapper. The secondary Company Brain fit (owners, decisions traced to KEPs) helps a little.

## EVIDENCE
- Pluto detects deprecated and removed APIs in files and Helm charts, supports target versions and has a GitHub Action: [Fairwinds](https://www.fairwinds.com/blog/kubernetes-easily-find-deprecated-api-versions-with-pluto), [Giant Swarm handbook](https://handbook.giantswarm.io/docs/support-and-ops/ops-recipes/check-deprecated-apis), [Plural guide (Pluto vs kubent)](https://www.plural.sh/blog/kubernetes-api-deprecation-tool-guide/).
- kubernetools MCP already serves version-specific K8s API reference to coding agents (latest plus 3 versions): [mcpservers.org](https://mcpservers.org/servers/kubernetools/mcp-server).
- Recent removals are obscure (flowcontrol v1beta3 in 1.32, v1beta2 in 1.29). The famous ones (HPA v2beta2 in 1.26) are old, so a live "agent writes a removed API" moment is unlikely without staging: [deprecation guide v1.35](https://v1-35.docs.kubernetes.io/docs/reference/using-api/deprecation-guide/), [v1.29](https://v1-29.docs.kubernetes.io/docs/reference/using-api/deprecation-guide).
- The removed feature gates page is structured ("To" column), and feature-state badges read the gate description files, so the truth layer is cheap to build: [feature-gates-removed](https://kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed), [includes docs](https://v1-33.docs.kubernetes.io/docs/home/contribute/includes/).
- FalkorDB supports `CALL algo.pageRank(label, relType) YIELD node, score`, so link-graph PageRank is confirmed: [docs](https://docs.falkordb.com/algorithms/pagerank). An official MCP server also exists: [FalkorDB-MCPServer](https://glama.ai/mcp/servers/FalkorDB/FalkorDB-MCPServer).
- A PreToolUse hook with exit code 2 blocks a Write and returns stderr to Claude, so the guard hook is a few lines: [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks).
- I found no published WeMakeDevs project-hackathon winners list, only prize announcements ([Telegram](https://t.me/s/WeMakeDevs)), so the judges' taste is unknown.

## Simulation
Day 1: the truth layer from the deprecation guide and feature-gate files, plus the stale count. This is likely to come in under 15 real findings, which flips the pitch toward the guard, the weak-graph half. Day 2: the MCP server, the hook and the KEP joins. KEP-to-gate mapping is messy because `kep.yaml` feature-gate names don't always match. Day 3: include/link/OWNERS/git-log ingestion and the canvas. `git log` on `kubernetes/website` is slow and noisy (bot and l10n commits). Day 4: README, Cypher, video, tunnel. The tunnel is fine because the data is static.
Judge questions that hurt: "How is this different from Pluto?" "Did Claude actually make this mistake, or did you prompt it?" "How many stale pages did you really find?" "Why is a graph needed for `is_current`?" "Who maintains this after each release?"

## TOP 3 FLAWS
1. **The headline feature is Pluto plus a citation.** Failure scenario: a judge runs `pluto detect-files` in their head and scores Graph-essential low.
2. **The staged agent error.** Failure scenario: on camera, Claude writes `batch/v1` correctly and the hook has nothing to catch, so the builder seeds the error by hand and the demo looks fake.
3. **Few real stale docs.** Failure scenario: the day-1 count finds 6 findings, mostly history sentences, and the "fix one example, repair 12 pages" visual collapses into 1–2 pages.

## THE BEST VERSION
Keep the truth layer, `is_current` and `explain_change`. Make the graph earn its place by having the guard traverse beyond the manifest: Kind → APIVersion → REPLACED_BY chain → required field changes (for example `targetAverageUtilization` → `target.averageUtilization`) → KEP, and return a patched manifest. Cut the git-log people routing first. Demo the guard on a real stale snippet copied from a popular third-party tutorial or StackOverflow answer instead of on Claude's own output. Show the Pluto comparison honestly, with "what Pluto says vs what we return".

## VERDICT
Build it with changes: the build is very shippable for one person, but cut it to a single sharp agent-guard story whose answer needs graph traversal, because as briefed it is a known lookup tool with a docs side-project attached.
