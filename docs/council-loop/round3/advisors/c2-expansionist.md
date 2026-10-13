# Candidate 2 — Expansionist advisor (Kubernetes "version truth" MCP + stale-docs impact ranking)

## SCORES (1–10)
- **Graph essential: 6.** `is_current` is essentially a lookup table (Pluto already ships it as a versions file). The graph earns its place only in the day-3 include→page→link propagation, PageRank and SIG/editor routing, and that is exactly the part scheduled last.
- **Demo memorability: 6.** "Agent writes a removed API, the hook catches it, the agent corrects itself and cites the KEP" is a clean 20-second story. The risk is that a current Claude model already writes `batch/v1` CronJobs, so the hook has nothing to catch unless the shot is staged.
- **4-day feasibility for one builder: 6.** The data is all public and parseable deterministically, and the cuts are sensible. Still, there are four parsers (KEP yaml, feature-gate front-matter, deprecation guide, Hugo shortcodes and includes), plus git-log ingestion, plus a hook and a canvas. That is tight but doable with parallel agents.
- **Originality vs competitors: 6.** Pluto and kubent cover detection. kubernetools MCP and Context7 cover "fresh docs for agents". No one I found combines an agent guard with provenance to the KEP and a docs-blast-radius ranking.
- **Real-world usefulness: 6.** The pain is real, since "no matches for kind" errors are a perennial support topic. But platform teams already run Pluto in CI, and SIG Docs is a small audience.

## WIN CHANCE (main track, Agents That Act on Connected Data): ~6%
With perhaps 150–250 real entries, a polished, deployed, MCP-native tool with real upstream issues filed lands comfortably in the top 10–15%. To *win*, judges must believe the graph is doing the reasoning. If the demo leads with `is_current`, a FalkorDB judge will say "that's a dict." The upside case is a demo that leads with a multi-hop answer a dict can't give. That could double these odds. Company Brain as a second entry adds a small extra chance.

## EVIDENCE
- Pluto finds deprecated or removed `apiVersion`s in static manifests and Helm, with CI exit codes; kubent does the same against live clusters. Neither has an MCP or provenance layer. [Pluto repo](https://github.com/FairwindsOps/pluto), [Fairwinds blog](https://fairwinds.com/blog/update-on-pluto-and-how-this-open-source-project-can-identify-deprecated-apis-in-kubernetes-1.22), [Plural guide](https://www.plural.sh/blog/kubernetes-api-deprecation-tool-guide/)
- The kubernetools MCP server serves the official API reference for the latest few K8s versions, so agents can avoid deprecated fields. It is the closest agent-side competitor, but it has no history, KEPs or docs impact. [mcpservers.org listing](https://mcpservers.org/pt-BR/servers/kubernetools/mcp-server)
- Context7 (~55K stars) already pitches "version-specific docs so agents stop using stale APIs". Judges will know it. [Context7 summary](https://trevorlasn.substack.com/p/context7-mcp-up-to-date-docs-for), [mcpservers.org](https://mcpservers.org/en/servers/upstash/context7-mcp)
- A "kubernetes-skill" grounding project for Claude Code and Codex targets deprecated or insecure AI-generated manifests, which validates the problem and shows the space is crowding. [sourcepulse](https://www.sourcepulse.org/projects/29914994)
- The stale-API failure modes are real: extensions/v1beta1 Ingress removed in 1.22, Deployments in 1.16. [golinuxcloud](https://www.golinuxcloud.com/kubernetes-api-deprecations/), [Helm docs](https://blog.helm.sh/docs/topics/kubernetes_apis)
- FalkorDB supports `CALL algo.pageRank(label, relType) YIELD node, score`, which confirms the PageRank claim. [FalkorDB PageRank](https://docs.falkordb.com/algorithms/pagerank.html), [procedures](https://docs.falkordb.com/cypher/procedures.html)
- An official FalkorDB MCP server exists (OpenCypher, read-only mode, HTTP or stdio), so the MCP plumbing is low-risk. [FalkorDB-MCPServer](https://glama.ai/mcp/servers/FalkorDB/FalkorDB-MCPServer)
- No published winners for WeMakeDevs/FalkorDB events; the rules stress "graph must be central". [WeMakeDevs FalkorDB](https://www.wemakedevs.org/hackathons/falkordb)

## SIMULATION (abridged)
- **Day 1:** ingest the deprecation guide, feature-gate files and KEPs; count stale findings. This is a likely break point, because `kep.yaml` stage fields are inconsistent across years.
- **Day 2:** build the MCP tools and hook, and file an issue.
- **Day 3:** includes, links, PageRank and routing; the canvas.
- **Day 4:** deploy, video, README.

Demo shot 2 breaks if Claude writes current YAML anyway. Shot 3 breaks if there are few shared stale examples.

Judge questions:
1. "Why not Pluto plus a dict?"
2. "Does Claude even make this mistake now?"
3. "How is PageRank a traffic proxy?"
4. "How many real stale pages did you find?"
5. "Who uses this after Saturday?"

## TOP 3 FLAWS
1. **The headline feature is the least graph-y.** Scenario: a judge sees `is_current` return "removed in 1.25", recognises Pluto's behaviour, and scores the graph as decoration before the ranking ever appears.
2. **The demo villain may not appear.** Scenario: Claude writes `autoscaling/v2` on the first try, the hook stays silent, and the builder has to plant a stale tutorial snippet. That reads as staged.
3. **Few real stale findings.** Scenario: the day-1 count returns 6, so the "one example lights up 20 pages" canvas becomes 2 pages, and the Company Brain story collapses.

## THE BEST VERSION
- **Keep** the MCP guard, KEP provenance and the real upstream issues. Filed issues are the standout credibility asset most entries won't have.
- **Re-lead the pitch with traversal.** For example: *"Upgrading to 1.33: what breaks in my repo, which docs taught me that pattern, and who owns the fix?"* That one multi-hop answer runs repo manifest → APIVersion → removed-in Release → replacement → docs Page that teaches it → SIG and editor.
- **Add an `upgrade_impact(from, to, path)` tool** that runs over a public repo of real Helm charts. This is the truly expansive move: an agent action driven by the graph, and useful to every platform team, not just SIG Docs.
- **Stage the guard honestly.** Feed it a real popular tutorial or StackOverflow manifest that uses a removed API, rather than hoping Claude errs.
- **Cut** the Claude history-vs-current classifier unless the stale count demands it, and the PageRank-as-traffic claim, which is unfounded (call it "link centrality").

## VERDICT
Build it with changes: lead with an upgrade-impact traversal and the filed upstream issues instead of a lookup-table guard, or judges will file the graph under decoration.
