# Council 2026-10-13: A (Maintainer Brain) vs B (Switchboard)
Five independent Opus advisors given a neutral brief (council-brief.md; A = "Q", B = "P"), then an Opus chair with the answers anonymized (council-answers.md).
Votes: Q/A ×3 (First Principles, Outsider, Executor), P/B ×2 (Contrarian, Expansionist). Chair: **A**, with corrections and triage outcomes as timestamped memory (a second entry for the Memory track).
Key reason: remove FalkorDB from A and nothing is left; B's graph is mostly a key-value store plus one traversal.
A's fixes: lead with "declared owner vs the real expert, proven by a graph path"; build the deterministic graph first and add Claude extraction later; check answers by hand; use corrections as a demo moment; README section on human direction (the AI-generated rule).
Repo check (10-13): FalkorDB/FalkorDB has 1,419 PRs, 1,766 issues, 70 contributors, Discussions on. But its CODEOWNERS only covers /build/ and /.github/ (team @FalkorDB/falkordb-core), so it has no per-component declared owners.
