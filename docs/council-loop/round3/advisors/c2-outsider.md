# Outsider advisor: candidate 2 (Kubernetes "version truth" MCP server)

As an outsider, here is the pitch as I'd repeat it: "An MCP tool that stops AI coding agents from writing Kubernetes YAML that no longer works, and tells the docs team which broken example to fix first." That is clear. The trouble is that it's really two products under one name, and only the second needs a graph.

## SCORES (1–10)
- **Graph essential: 5.** `is_current` is a lookup (apiVersion to removed-in to replacement). Pluto already does it from a flat `versions.yaml`. The graph earns its place only in the day-3 include/link propagation and the SIG routing.
- **Demo memorability: 5.** "Agent writes a removed apiVersion, the hook fires, the agent fixes it" is easy to follow. But it's a linter warning, and a judge has seen plenty of those. The one-example-lights-up-many-pages canvas is the memorable shot, and it's scheduled last.
- **4-day feasibility: 5.** The truth layer is easy, since the migration guide is small and structured. Parsing every `kep.yaml`, the feature-gate files, the `code_sample` includes, OWNERS files, git-log editors, claim extraction, an LLM classifier, a hook, a canvas and upstream issues is far more surface area than one person can polish in 4 days.
- **Originality: 5.** Pluto and kubent cover detection, kube-lint-mcp already puts deprecated-API checks behind MCP for Claude Code, and Context7 already pitches "stop stale training data". The docs impact ranking is the new part.
- **Real-world usefulness: 5.** It's real but narrow. Recent releases removed few APIs: the last big ones were v1.25, v1.26, v1.29 and v1.32 (flowcontrol). Frontier models rarely write `batch/v1beta1` CronJobs any more, and a server-side dry run already catches removed APIs. K8s docs maintainers would find the ranking useful, but there are only a few dozen of them.

## WIN CHANCE (main track: Agents That Act on Connected Data): ~5%
It's well scoped, has a clear MCP angle, uses real public data and leaves a provenance path, so it sits above the median. But the agent part looks like Pluto in an MCP wrapper, and a judge asking "why a graph?" gets a good answer only from the secondary feature. Against 100–300 submissions with flashier fraud or codebase agents, I'd estimate 4–6%. The Company Brain track is a weaker fit: there are no tickets or chats in the data.

## EVIDENCE
- Pluto finds deprecated and removed apiVersions in files and Helm releases, is actively maintained (v5.24.0) and ships a `versions.yaml`: https://github.com/FairwindsOps/pluto, https://civo.com/learn/pluto-a-tool-to-manage-deprecated-kubernetes-apis
- An overview of the existing deprecation tooling (Pluto, kubent): https://www.plural.sh/blog/kubernetes-api-deprecation-tool-guide/
- kube-lint-mcp is an MCP server for Claude Code that runs dry-runs and says it catches deprecated API versions: https://pypi.org/project/kube-lint-mcp/0.8.8/
- Context7 is the well-known "fresh docs for coding agents" MCP, the same story in general form: https://archestra.ai/mcp-catalog/upstash__context7
- The removal timeline (v1.25 CronJob/PSP, v1.26 HPA v2beta2, v1.29/v1.32 flowcontrol): https://v1-34.docs.kubernetes.io/docs/reference/using-api/deprecation-guide/
- Kyverno already has a "check deprecated APIs" policy: https://kyverno.io/policies/best-practices/check-deprecated-apis/check-deprecated-apis/
- FalkorDB `algo.pageRank(label, relType)` exists, so PageRank on `LINKS_TO` is supported: https://docs.falkordb.com/algorithms/pagerank
- I found no named list of past WeMakeDevs winners; their hackathons are sponsor-tool showcases: https://www.wemakedevs.org/llms.txt

## Simulation
**Build:** Day 1 is truth-layer ingest plus the stale count. It holds unless KEP stage data is messy (it is). Day 2 is the MCP tools and the hook. The risk is that Claude already writes `batch/v1`, so the demo needs a forced or older-target prompt. Day 3 is the include graph, PageRank and routing, which is achievable but rushed. Day 4 is the canvas, the video, deployment and the README. There is no slack for an upstream issue cycle.

**Demo:** In shot 2 a judge will notice if the agent had to be coaxed into the mistake. Shot 3 is the real "aha" moment but arrives at 1:10.

**Judge questions:**
1. Why not Pluto plus a dry run?
2. Would Claude actually make this mistake today?
3. Remove FalkorDB: what breaks besides the ranking?
4. How many real stale pages did you find?
5. Who would install this?

Questions 1–3 hurt.

## TOP 3 FLAWS
1. **The headline feature is a lookup table.** Scenario: a judge asks "isn't this Pluto's versions.yaml?" and the honest answer is yes. That fails the "graph is decoration" test for the main track.
2. **The staged failure may not happen naturally.** Scenario: asked for a CronJob, Claude writes `batch/v1` correctly. The builder has to prompt "for k8s 1.20 style", and the demo looks rigged.
3. **The stale-docs count may be small.** Upstream K8s docs are well maintained. Scenario: the 3-hour count finds 6 real hits, the strongest graph feature becomes a minor view, and the pitch falls back to flaw 1.

## THE BEST VERSION
Lead with the graph-native story: "one stale shared example breaks N pages, and here's who owns the fix". Make the agent guard a side benefit. Extend the truth layer to feature gates and field-level changes, where lookups really do need KEP→gate→release traversal and models are actually wrong. Cut the LLM claim classifier unless the counts demand it. Show the grep-versus-graph comparison early. File the upstream issue on day 1 so a reply can land in the video.

## VERDICT
Build it with changes: flip the pitch so the graph-only docs-impact traversal is the star and the MCP lint check is the supporting act. As briefed, the core is a lookup that existing tools already do.
