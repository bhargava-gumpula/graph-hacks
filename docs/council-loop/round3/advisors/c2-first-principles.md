# First Principles review: Candidate 2, Kubernetes "version truth" MCP server

**The problem underneath.** Coding agents write `apiVersion`s that a cluster rejects. Answering "is this apiVersion removed at version N, and what replaces it?" is a lookup in a table of about 50 rows (the official deprecated-API migration guide), and that table changes only a few times a year. Pluto does exactly this offline (`detect-files --target-versions=k8s=1.30`), and `kubectl apply --dry-run=server` is the true authority. Neither the headline feature (`is_current`) nor `explain_change` needs a graph. The release → KEP → SIG chain is one join done three times. The only part that needs a graph is the day-3 stale-docs impact ranking. It walks Example ← INCLUDES ← Page and uses PageRank on LINKS_TO, and the brief makes that part conditional on finding at least 15 real stale findings.

## SCORES (1–10)
- **Graph essential: 4.** The agent guard still works with FalkorDB removed (a dict or Pluto does it). The include/link propagation is real graph work, but it is the optional half.
- **Demo memorability: 6.** "Agent writes a removed CronJob apiVersion, the hook catches it, the agent cites the KEP" is clear and easy to follow. The canvas where one example file lights up many pages makes a strong visual if the data supports it.
- **4-day feasibility: 5.** Parsing `kep.yaml`, the feature-gate files and the migration guide is easy. Pulling claims out of Hugo pages (shortcodes, inline YAML, gate sentences) and running the history-vs-current classifier will take longer than planned. With two ingestion layers plus a hook, an MCP server, a canvas and routing, the work is spread across many features.
- **Originality: 4.** Pluto, kubent and kubectl-convert cover detection and migration. kube-lint-mcp already exposes deprecated-API checks to Claude Code over MCP. Context7 serves agents up-to-date docs. The new part is ranking docs-fix impact, and that has no clear user.
- **Real-world usefulness: 4.** Platform teams already run Pluto in CI. SIG Docs could use the ranking, but kubernetes/website appears to test its example manifests against current APIs, so removed apiVersions in examples should be rare. Stale claims will mostly be prose, which the brief calls "secondary."

## WIN CHANCE (Agents That Act on Connected Data): ~4%
The track wants multi-hop reasoning and graph algorithms used as agent tools. A judge who asks "couldn't this be a JSON file?" gets a yes for the main tool. Among 100–300 submissions, entries whose answers come from a traversal will beat this one. A typical entry has roughly a 1–2% base rate. The clean MCP+hook story and the possibility of a real upstream issue add a little to that.

## EVIDENCE
- Pluto does static detection of deprecated and removed apiVersions in manifests and Helm charts, with target versions and CI exit codes: [Fairwinds](https://www.fairwinds.com/blog/kubernetes-easily-find-deprecated-api-versions-with-pluto), [Giant Swarm handbook](https://handbook.giantswarm.io/docs/support-and-ops/ops-recipes/check-deprecated-apis), [Plural tool guide](https://www.plural.sh/blog/kubernetes-api-deprecation-tool-guide/).
- An MCP server already exists for Claude Code that catches deprecated API versions through dry-runs: [kube-lint-mcp](https://pypi.org/project/kube-lint-mcp/0.8.8/).
- Migration is tool-assisted and the cluster is the authority: [CNCF/DoiT](https://www.cncf.io/blog/2020/09/01/kubernetes-how-to-automatically-detect-and-deal-with-deprecated-apis-2/), [kubectl-convert guide](https://oneuptime.com/blog/post/2026-02-09-api-deprecations-kubectl-convert/view).
- Context7 already sells "stale training data → current docs via MCP": [Context7](https://context7.com/guides), with [Marginlab](https://marginlab.ai/blog/do-mcps-improve-coding-agents-part-1/) questioning whether such MCPs measurably help.
- FalkorDB's `CALL algo.pageRank(label, relType) YIELD node, score` is confirmed: [docs](https://docs.falkordb.com/algorithms/pagerank.html).
- `feature_gate_name` makes feature-state badges dynamic, so the stale badges left are the ones without it. Real stale-gate bugs exist but they are small: [shortcode docs](https://kubernetes.io/docs/contribute/style/hugo-shortcodes), [website#46575](https://github.com/kubernetes/website/issues/46575).
- I found no published lists of WeMakeDevs winners ([wemakedevs.org](https://wemakedevs.org)), so I can't calibrate against past winners.

## SIMULATION (where it breaks)
- **Day 1:** truth layer done by midday. The 3-hour stale count most likely comes back under 15, so the graph-heavy half gets demoted before it is built.
- **Day 2:** MCP server and hook work, so the agent guard is the pitch. The graph is now a lookup.
- **Day 3:** Hugo claim extraction runs into shortcode edge cases, and the classifier needs prompt tuning.
- **Demo shot 2 risk:** Claude Code today often writes `batch/v1` CronJob correctly, so the hook may have nothing to catch unless the prompt is staged.
- **Judge questions:** (1) Why not Pluto? (2) Remove FalkorDB: does `is_current` still work? (yes) (3) How many real stale pages did you find? (4) Who asked for docs-fix ranking? (5) Does PageRank on links actually track traffic? (not shown)

## STEELMAN / ATTACK
- **For:** a real, verifiable pain. Public data with ground truth. Agent-native delivery through a hook. Upstream issues filed give proof of usefulness. The multi-hop include propagation is a real graph use case.
- **Against:** the half that gets the most stage time is a solved lookup problem. The half that needs the graph depends on data that may not exist and serves a small audience (SIG Docs reviewers).

## TOP 3 FLAWS
1. **The graph is decoration for the main tool.** A judge applies the stated rule: replace FalkorDB with Pluto's versions file and the demo's star moment still works.
2. **The stale-docs premise is unproven.** The count finds 6 stale claims. The ranking canvas then shows two nodes and the grep baseline matches it, so "what a lookup can't do" disappears.
3. **Staged hook moment.** In a live run the agent writes the correct apiVersion, so the presenter has to force a stale snippet and the demo looks contrived.

## THE BEST VERSION
Cut the People/EDITED routing and the claim classifier. Keep the truth graph and the hook. Make the graph earn its place by broadening the corpus beyond kubernetes/website: the public Helm charts and tutorial repos agents actually copy from. Then the INCLUDES/USES traversal and PageRank decide which upstream artifact poisons the most downstream manifests. Run the stale count before committing to this idea.

## VERDICT
Build it with changes: the agent guard alone is a Pluto wrapper, so it is only worth building if the day-1 count shows that the multi-hop docs/charts impact traversal has real data behind it.
