# Council loop: final report (2026-10-13)

## Bottom line
**The target was not reached.** No candidate averaged ≥15% win chance with every advisor at ≥12%. The loop stopped at the budget cap after 3 rounds and 40 advisor runs. The best-scoring idea in the whole loop was the **round-1 npm maintainer-reach agent** (8.6% average, lowest advisor 7%). It scored higher than both later revisions of itself.

Across 40 independent advisors, no single estimate went above 10%. With 100–300 expected real submissions, calibrated advisors seem to place a strong, well-scoped entry at about 8–10%. Our revisions moved scores by about ±2 points; none came close to doubling them. Treat 15% as a stretch target, not a gate.

| Round | Candidate | Avg win % | Range | Graph | Demo | Feas. | Orig. | Use |
|---|---|---|---|---|---|---|---|---|
| 1 | Switchboard, best version | 6.2 | 5–10 | 6.8 | 6.2 | 5.0 | 5.0 | 4.6 |
| 1 | Maintainer Brain, best version | 7.0 | 5–9 | 6.8 | 6.2 | 5.2 | 4.8 | 5.8 |
| **1** | **npm maintainer-reach agent** | **8.6** | **7–10** | **8.2** | **7.4** | 5.4 | 5.0 | 5.8 |
| 1 | Kubernetes docs freshness | 7.4 | 6–9 | 6.8 | 6.0 | 5.8 | 6.4 | 5.8 |
| 2 | npm "who can ship code into your app" | 6.0 | 5–7 | 7.4 | 6.6 | 5.0 | 5.8 | 5.2 |
| 2 | Kubernetes outdated-docs finder | 7.2 | 5–8 | 6.0 | 5.8 | 5.2 | 6.4 | 5.8 |
| 3 | npm pre-install guard for agents | 6.4 | 5–8 | 6.6 | 6.0 | 6.2 | 5.6 | 4.8 |
| 3 | Kubernetes version-truth MCP | 4.6 | 4–6 | 4.8 | 5.4 | 5.4 | 5.0 | 4.8 |

All 40 verdicts were "build it with changes". Per-round detail is in `round1/results.md`, `round2/results.md` and `round3/results.md`; every advisor's full report is in `roundN/advisors/`.

## Winner: npm maintainer-reach agent (round 1, candidate 3)
Scorecard per advisor (1–10; win %):

| Advisor | Graph | Demo | Feasibility | Originality | Usefulness | Win % |
|---|---|---|---|---|---|---|
| Contrarian | 8 | 6 | 5 | 4 | 5 | 7 |
| First Principles | 8 | 7 | 5 | 4 | 5 | 8 |
| Expansionist | 9 | 8 | 6 | 6 | 7 | 10 |
| Outsider | 8 | 8 | 6 | 5 | 6 | 10 |
| Executor | 8 | 8 | 5 | 6 | 6 | 8 |
| **Average** | **8.2** | **7.4** | **5.4** | **5.0** | **5.8** | **8.6** |

It had the highest graph-essential and demo scores of any candidate, and it was the only one that every advisor put at 7% or more.

### Fixes to apply if you build it
These are the advisors' fixes that held up in later rounds. Apply them, but **keep the round-1 shape: do not import round 2's mistakes.**
- **Ethics and framing:** rank packages and paths, never named people; anonymise accounts. Cite "Small World with High Risks" (USENIX Security 2019) and say what's new: the Sept 2025 replay, the worm model, and an agent that acts.
- **Honest metrics:** reach is a count of distinct dependent packages, not summed downloads (which double-count installs). Label maintainer data as "listed maintainers"; it misses org and team publishing.
- **Scope:** cut betweenness, the Advisory and Repo nodes, and the "one removal" optimiser. Seed from the top 2,000 packages, not 5,000. Precompute reach and PageRank into node properties so live queries only read them, and bound live traversals.
- **Lockfile semantics:** frame lockfile exposure as "on your next update or fresh install". A committed lockfile pins exact versions, and round 2 was marked down hard for missing this.
- **Don't** treat provenance or trusted publishing as a barrier to a stolen token: it isn't one, and the real control (disallowing tokens) isn't public. **Don't** promise to "validate" a worm model against the real Shai-Hulud victim list (expected recall is near zero); call the replay an illustration.
- **Demo:** pick contrast cases with real numbers on day 1. Round 3 found that the obvious pairs (moment, dayjs, date-fns) have no runtime dependencies and would show no contrast.

### The winning brief (as evaluated)
## The idea: an agent that finds the npm maintainer accounts whose compromise would reach the most software
In September 2025 one npm maintainer's account was phished and malicious versions of chalk, debug and 16 other packages (about 2 billion weekly downloads) were published within hours. Days later the self-spreading "Shai-Hulud" worm hit hundreds of packages. This project models the npm ecosystem's dependency and maintainer graph in FalkorDB and lets an agent answer "whose account is a single point of failure, and through which paths would an attack spread?"

- **Scope:** the dependency closure of the 5,000 most-depended-on npm packages (an estimated 20,000–40,000 packages), latest versions only, runtime dependencies only.
- **Graph model:**
  - `(:Package {name, weekly_downloads, last_publish})-[:DEPENDS_ON {range}]->(:Package)`
  - `(:Maintainer)-[:CAN_PUBLISH]->(:Package)` (from the npm registry's maintainers list)
  - `(:Package)-[:HOSTED_AT]->(:Repo)`; `(:Advisory)-[:AFFECTS]->(:Package)` (from the public OSV/GitHub Advisory data)
- **What it does (graph algorithms are the core):**
  - **Maintainer reach:** for each maintainer, the set of packages that transitively depend on anything they can publish, and the downloads that set represents. A variable-length reverse traversal in Cypher.
  - **Load-bearing packages:** PageRank on the dependency graph, and betweenness centrality to find "bridge" packages that many dependency paths pass through.
  - **Single points of failure:** packages in the top 1% of PageRank with exactly one maintainer who can publish; shown with the paths to well-known packages that depend on them.
  - **Attack replay:** select a maintainer (e.g. the account compromised in Sept 2025); the canvas animates the reverse traversal outward, hop by hop, with a running download total.
  - **"Am I exposed?":** paste a `package-lock.json`; the agent returns which maintainer accounts can push code into this project, through which shortest paths, and which single dependency removal cuts the most of that exposure.
  - **Agent + MCP:** Claude answers questions in plain language by choosing among 4 typed MCP tools (`maintainer_reach`, `paths_between`, `single_points_of_failure`, `lockfile_exposure`), each showing its Cypher, and drafts a short risk note with the paths as evidence.
- **Data:** the public npm registry API and downloads API, deps.dev for dependents counts, OSV for advisories. Collected on day 1 with a rate-limited crawler and cached; the README lists the snapshot date.
- **Claude API use:** only for answering questions and writing notes; all analysis is Cypher and FalkorDB algorithms.
- **Planned 2-minute demo:** (1) "Replay September 2025": select the compromised maintainer, watch the spread reach well-known projects with the download counter climbing; (2) "Who is the next one?": the top 10 single points of failure today, each with the path to a famous package; (3) paste the lockfile of a popular open-source app and get its maintainer exposure plus the one dependency to remove.
- **Out of scope:** other ecosystems, historical versions, detecting malicious code, contacting maintainers.
- **Intended tracks:** Agents That Act on Connected Data (main).

## Runner-up: Kubernetes docs freshness (round 1, candidate 4; its round-2 revision scored 7.2%)
| Advisor | Graph | Demo | Feasibility | Originality | Usefulness | Win % |
|---|---|---|---|---|---|---|
| Contrarian | 7 | 5 | 5 | 6 | 4 | 6 |
| First Principles | 6 | 6 | 6 | 6 | 6 | 8 |
| Expansionist | 7 | 7 | 6 | 7 | 6 | 8 |
| Outsider | 8 | 6 | 6 | 6 | 7 | 9 |
| Executor | 6 | 6 | 6 | 7 | 6 | 6 |
| **Average** | **6.8** | **6.0** | **5.8** | **6.4** | **5.8** | **7.4** |

It had the highest originality of any candidate and solid usefulness, with verifiable outside proof (real upstream issues). Its weakness is that the first hop is a grep join, and Kubernetes' `feature-state` shortcode already auto-updates many pages. The graph only earns its place through impact propagation: one shared example file is included by many pages, plus ranking and routing. Brief: `round1/candidate-4.md` (revision: `round2/candidate-2.md`).

## What changed each round, and why
- **Round 1 (4 candidates, 20 advisors).** The best versions of Switchboard and Maintainer Brain from Council 3, plus two new ideas built around graph algorithms and real data: npm maintainer reach, and Kubernetes docs truth maintenance.
  - Switchboard failed on usefulness (4.6): "block within 3 import hops" serialises agents, because hub files sit near everything, and worktrees and existing lock tools cover the rest.
  - Maintainer Brain failed on graph necessity: FalkorDB's PageRank and label propagation take no edge weights or filters, so a SQL `GROUP BY` reproduces most of it.
  - npm and Kubernetes advanced.
- **Round 2 (2 candidates, 10 advisors).**
  - npm was reshaped into lockfile exposure, provenance barriers, a worm mode with validation against the real victim list, and "harden 10". It **fell from 8.6 to 6.0**: every advisor caught that a lockfile pins versions and that provenance doesn't stop a stolen token, and the validation would show near-zero recall. Lesson: fixing one critique by adding mechanism added new attack surface.
  - Kubernetes gained exclusions for auto-maintained pages, deterministic claims, a people and ticket layer, a backtest and an agent guard. It held at 7.2, but advisors said the graph was now a lookup table, and the best beats sat below the cut line.
- **Round 3 (2 candidates, 10 advisors).** Both were pivoted to "guards that coding agents call", with corrected semantics and smaller scope.
  - The npm guard was technically sound (feasibility 6.2) but scored 6.4: its demo pair had no real contrast, the core query is a set difference that doesn't need a graph database, and Socket MCP is close prior art.
  - The Kubernetes guard fell to 4.6: `is_current` is a Pluto-style lookup that works without FalkorDB.
  - Lesson: moving the headline away from the graph-native part costs more on "graph essential" than the agent framing gains.

## Estimated spend
- **Advisors:** 40 Opus 5.5 runs, each with 13–21 tool steps and a final context of about 67–75k tokens; about 23.7M context-tokens processed in total. With Claude Code's prompt caching (cache reads at 10% of the $4/MTok input price, about 70k cache-write tokens and about 10k output tokens per run), that is about **$30**, roughly $0.75 per advisor.
- **Orchestrator** (this session: reading, writing briefs, scoring): about **$4–6**.
- **Estimated total: about $35** (range $30–40), under the $45 stop line. Without any prompt caching the same tokens would cost about $100. Caching is on by default in Claude Code, so I treated that as an unrealistic upper bound, but the figure is an estimate, not a bill. Check the account's usage page for the real number.
- The loop stopped because it reached the task's 40-run fallback cap, which also kept it inside the dollar estimate.

## Open risks
1. **The target may be unreachable with this method.** Calibrated advisors never estimated above 10% for any version. If 15% is a hard gate, no idea of this kind passes it. Use the ranking, not the absolute number.
2. **The winner's novelty is moderate (originality 5.0).** Its core finding is 2019 research. It wins only if the Sept 2025 replay, the worm illustration and the agent's actions land visibly in the demo.
3. **Day-1 data risk.** The npm crawl (thousands of full packuments, including multi-MB ones) could eat day 1. Size the seed list from the first hour's real throughput, and keep a cached snapshot.
4. **Data truth.** The npm `maintainers` field doesn't reliably show who can publish (org and team publishing, trusted publishing). Every number must be labelled "listed maintainers", or a security judge will discredit it.
5. **The FalkorDB algorithm limits** found by advisors (unweighted, global PageRank; no property filters) shape the design: precompute projections into separate graphs, or score in Cypher.
6. **Ethics and optics.** Anything that looks like a list of people to phish is a judging and PR risk. Rank packages, anonymise accounts.
7. **The pre-start rule:** everything here is ideas and notes. No product code was written.
