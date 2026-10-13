# Council 2026-10-13: A (Maintainer Brain) vs B (Switchboard)
Five independent Opus advisors given a neutral brief (council-brief.md; A = "Q", B = "P"), then an Opus chair with the answers anonymized (council-answers.md).
Votes: Q/A ×3 (First Principles, Outsider, Executor), P/B ×2 (Contrarian, Expansionist). Chair: **A**, with corrections and triage outcomes as timestamped memory (a second entry for the Memory track).
Key reason: remove FalkorDB from A and nothing is left; B's graph is mostly a key-value store plus one traversal.
A's fixes: lead with "declared owner vs the real expert, proven by a graph path"; build the deterministic graph first and add Claude extraction later; check answers by hand; use corrections as a demo moment; README section on human direction (the AI-generated rule).
Repo check (10-13): FalkorDB/FalkorDB has 1,419 PRs, 1,766 issues, 70 contributors, Discussions on. But its CODEOWNERS only covers /build/ and /.github/ (team @FalkorDB/falkordb-core), so it has no per-component declared owners.

# Council 2, 2026-10-13: separate, blind evaluations
Ten Opus advisors. Five saw only brief-1 (Switchboard) and five saw only brief-2 (Maintainer Brain); no advisor knew another idea existed. Absolute scores, 1–10, where 5 = a typical entry.

| Average | Switchboard (B) | Maintainer Brain (A) |
|---|---|---|
| Graph essential | 7.0 | 7.0 |
| Demo memorability | 6.8 | 6.0 |
| 4-day feasibility | 5.4 | 4.8 |
| Originality | 4.8 | 4.0 |
| Real-world usefulness | 5.8 | 6.2 |
| Win chance, main track | ~12% (PS5) | ~9% (Mac Mini) |
All 10 verdicts: "build it with changes". Both are crowded and over-scoped.
B narrowed: a claim with a multi-hop blast-radius warning, kill-and-resume briefing, a "why" trace; Claude Code only; seeded deterministic demo; claim time limit; built with itself.
A narrowed: one triage story on FalkorDB's repo (stale or declared owner → real expert + past fix, each cited); bus-factor via PageRank/centrality; an MCP server; a "graph off" comparison; extraction only for releases and RFCs.
