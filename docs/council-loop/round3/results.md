# Round 3 results

Two radically revised candidates, five fresh blind Opus 5.5 advisors each. Full reports are in `advisors/`.

| Candidate | Graph | Demo | Feasibility | Originality | Usefulness | **Win %** | Lowest advisor |
|---|---|---|---|---|---|---|---|
| 1. npm pre-install guard for coding agents | 6.6 | 6.0 | 6.2 | 5.6 | 4.8 | **6.4** | 5 |
| 2. Kubernetes "version truth" MCP for coding agents | 4.8 | 5.4 | 5.4 | 5.0 | 4.8 | **4.6** | 4 |

| Per-advisor win % | Contrarian | First Principles | Expansionist | Outsider | Executor |
|---|---|---|---|---|---|
| C1 | 5 | 5 | 8 | 6 | 8 |
| C2 | 4 | 4 | 6 | 5 | 4 |

All 10 verdicts were "build it with changes". The target was not reached.

## Findings
- **C1 (npm guard):** the corrected semantics held up; no advisor found the lockfile or provenance errors again, and feasibility rose to 6.2. But 4 of 5 advisors found that the scripted demo pair (moment, dayjs, date-fns) all have zero or near-zero runtime dependencies, so the "1 vs 40 new publishers" contrast wouldn't exist on camera. The core query is a set difference that a recursive walk can do without a graph database (an existing dependency-maintainers CLI does it). Socket's MCP server is close prior art. A raw publisher count ignores npm's newer 2FA and trusted-publishing rules.
- **C2 (Kubernetes guard):** making the agent guard the headline backfired. All 5 advisors said `is_current` is a ~50-row lookup that Pluto (`versions.yaml`), kubeconform and kube-lint-mcp already do, so it keeps working without FalkorDB. The graph-dependent docs-impact ranking was demoted to day 3. Current Claude models rarely write removed apiVersions, so the demo would be staged.

## Budget stop
This round brought the total to 40 advisor runs (20 + 10 + 10), the task's fallback cap. The estimated spend is in `FINAL.md`. The loop stops here.
