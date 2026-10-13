# Round 2 results

Two revised candidates, five fresh blind Opus 5.5 advisors each (none had seen round 1). Full reports are in `advisors/`.

| Candidate | Graph | Demo | Feasibility | Originality | Usefulness | **Win %** | Lowest advisor |
|---|---|---|---|---|---|---|---|
| 1. npm "who can ship code into your app" (revised round-1 C3) | 7.4 | 6.6 | 5.0 | 5.8 | 5.2 | **6.0** | 5 |
| 2. Kubernetes outdated-docs finder (revised round-1 C4) | 6.0 | 5.8 | 5.2 | 6.4 | 5.8 | **7.2** | 5 |

| Per-advisor win % | Contrarian | First Principles | Expansionist | Outsider | Executor |
|---|---|---|---|---|---|
| C1 | 6 | 5 | 7 | 6 | 6 |
| C2 | 5 | 7 | 8 | 8 | 8 |

All 10 verdicts were "build it with changes". The target was not reached. Both revisions scored at or below their round-1 versions.

## Why the revisions did not help
- **C1 (npm) fell from 8.6 to 6.0 because the revision introduced two technical errors, and all 5 advisors caught them.**
  1. A committed `package-lock.json` already pins every transitive version, so "floating" ranges matter only on the next update or a fresh install. The "47 → 9" headline would not survive one question.
  2. Provenance does not stop a stolen-token publish; only "disallow tokens" does, and that setting is not public. The advisors also said a 2026 worm published with valid provenance, and npm revoked classic tokens in 2025.
  The promised "validation against the real Shai-Hulud list" would likely show recall near 0–10%, because the victims were long-tail packages infected through developer installs. Five features was too much scope.
- **C2 (Kubernetes) went 7.4 → 7.2.** Usefulness and originality held, but the graph score fell (6.0): stale-claim detection is really a lookup against a table of gate changes, which SQLite could do. The two most memorable beats (the `is_current` agent guard and the backtest) sat below the day-3 cut line. The GitHub reviewer and issue layer is a lot of work for little gain (the same sig-docs approvers on every card). The number of truly stale pages left after exclusions may be small (5–10). All 5 advisors said to promote the agent guard to day 2.

## Advancing to round 3
Both, revised more radically: simpler, technically correct and centred on the agent. The npm candidate becomes a pre-install guard that coding agents call; the Kubernetes candidate becomes a version-truth MCP for coding agents, with impact propagation through shared example files.
