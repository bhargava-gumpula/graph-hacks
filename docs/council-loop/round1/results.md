# Round 1 results

Four candidates, five blind Opus 5.5 advisors each (Contrarian, First Principles, Expansionist, Outsider, Executor). Each advisor saw only its brief, `advisor-process.md` and `HACKATHON.md`, and did 13–21 research steps. Full reports are in `advisors/`.

## Averages (1–10; win chance in %)
| Candidate | Graph | Demo | Feasibility | Originality | Usefulness | **Win %** | Lowest advisor |
|---|---|---|---|---|---|---|---|
| 1. Switchboard, best version (agent edit traffic control) | 6.8 | 6.2 | 5.0 | 5.0 | 4.6 | **6.2** | 5 |
| 2. Maintainer Brain, best version (issue → real expert) | 6.8 | 6.2 | 5.2 | 4.8 | 5.8 | **7.0** | 5 |
| 3. npm maintainer-reach agent (Sept 2025 replay) | **8.2** | **7.4** | 5.4 | 5.0 | 5.8 | **8.6** | 7 |
| 4. Kubernetes docs freshness (truth maintenance) | 6.8 | 6.0 | 5.8 | **6.4** | 5.8 | **7.4** | 6 |

## Per-advisor win %
| | Contrarian | First Principles | Expansionist | Outsider | Executor |
|---|---|---|---|---|---|
| C1 | 5 | 5 | 10 | 6 | 5 |
| C2 | 6 | 7 | 9 | 8 | 5 |
| C3 | 7 | 8 | 10 | 10 | 8 |
| C4 | 6 | 8 | 8 | 9 | 6 |

All 20 verdicts were "build it with changes". No candidate reached the target (≥15% average, every advisor ≥12%).

## What the advisors found
- **C1 Switchboard (5 of 5 agreed):** "Block any edit within 3 import hops of a claimed file" serialises agents in a real TypeScript repo, because hub files (types, utils, barrels) sit near everything, so WCC returns one component. Git worktrees (the official approach) and existing PreToolUse lock tools (agent-locks, agent-coord, CodeFleet, Clash) already cover most of it. Usefulness was the lowest of all candidates (4.6).
- **C2 Maintainer Brain:** FalkorDB's `algo.pageRank` and label propagation take no edge weights or property filters, so "recency-weighted PageRank per component" would move outside the graph; a SQL `GROUP BY` recency count reproduces most of it; vite and pydantic have concentrated ownership, so the same 2–3 people top every component; there are too many features for 4 days.
- **C3 npm reach:** the strongest graph and demo scores, but its headline repeats Zimmermann et al., "Small World with High Risks" (USENIX Security 2019). The summed download counter double-counts installs. A list of named maintainers labelled "next to compromise" reads as a phishing target list. The npm `maintainers` field misses org, team and trusted publishing. The day-1 crawl and unbounded reverse traversals are the feasibility risks. Fixes proposed: anonymise people, use provenance and trusted-publishing data as a new signal, add a Shai-Hulud worm propagation mode, a "harden these N" action, lockfile → pins and overrides, a time dimension and release-age gates, and precomputing reach.
- **C4 Kubernetes docs:** the highest originality, but the first hop is a grep join, and Kubernetes' `feature-state` shortcode with `feature_gate_name` already auto-updates many pages. Regex mentions would flag historical text (expected precision about 40%). Second-hop link propagation is mostly noise. Company Brain fit is narrow with no tickets or people. Fixes proposed: exclude auto-maintained pages, show a grep baseline with per-hop precision, add k/website issues and PRs as the ticket and people layer to route fixes, an `is_current` guard for coding agents, file real upstream issues, plain-English cards.

## Advancing to round 2
C3 (8.6%) and C4 (7.4%). Both are revised by changing the idea to fix these flaws.
