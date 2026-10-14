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

# Council 3, 2026-10-13: deep, blind evaluations (Fable 5.1), which supersedes Council 2
Same setup as Council 2 (each advisor saw one idea only), plus a required process (advisor-process.md): 6+ cited searches, a simulation of the build, demo and judge questions, steelman before attack. 13–23 research steps each.

| Average (1–10) | Switchboard (B) | Maintainer Brain (A) |
|---|---|---|
| Graph essential | 6.4 | 6.2 |
| Demo memorability | 6.0 | 6.2 |
| 4-day feasibility | 5.4 | 5.0 |
| Originality | 5.0 | 4.2 |
| Real-world usefulness | 5.6 | 6.4 |
| Win chance, main track | ~8% (6–10) | ~9% (6–11) |
All 10 verdicts: "build it with changes". It's a statistical tie.

Shared findings: in both, only the multi-hop parts truly need the graph, so make FalkorDB's graph algorithms the hero (no SQL equivalent); show the Cypher on screen; script or seed the demo; draw only the reasoning subgraph. FalkorDB's past winner (Atrium, Memory Meets Motion) won because the graph *was* the model.
B competitors: Befall, Junto, agent-locks, CoordMCP, Claude Code agent teams (native claims and task list), Graphiti MCP on FalkorDB. B's best form: Claude Code only; symbol-level import graph; PreToolUse hook *denies* conflicting edits and shows the dependency path; claims with a time limit; SessionStart hook auto-briefing (kill and resume); "why" path; graph canvas as the hero; WCC for "safe to run in parallel"; built with itself.
A competitors: FalkorDB's own Code-Graph (code structure, not people), Unblocked, Dosu, GitHub native duplicate detection, checkowners. A's best form: the triage path issue → component → past fix → expert; labelPropagation on co-change to derive components; PageRank on co-review for experts; bus factor; ownership drift; corrections as bi-temporal facts (the live correction loop); 3 typed MCP tools; decision extraction only on the triage path; hand-verified answers; maybe a livelier repo than FalkorDB's (its ownership may be the same two people everywhere).
Practical (either idea): install Docker/OrbStack + cloudflared on the demo Mac tonight; Claude Code agents must run on the subscription, not the $100 API key; Anthropic has no embeddings (use local).

# Council 4, 2026-10-13: blind Fable finalists
Ten Fable advisors, five per idea, each seeing only its own brief (brief-standards.md, brief-npm.md).
| Average | Standards Brain | npm blast radius |
|---|---|---|
| Graph / Demo / Feasibility / Originality / Usefulness | 6.2 / 6.8 / 6.6 / 6.0 / 6.0 | 7.2 / 6.8 / 6.0 / 5.2 / 5.6 |
| Win % per advisor | 6, 10, 10, 12, 12–18 | 5–8, 6–8, 8, 12, 12–15 |
| Average win % | **~10.6%** (the best so far) | ~9.4% |
npm problems: a live "Blast Radius" web app already exists; the 2025 replay can't be reproduced from today's maintainer lists (7 of the 18 packages); in-graph reach undercounts by 10×; the seed list is led by devDependencies.
Standards Brain problems: the mail archive is bot-blocked (use Datatracker ballots); the headline lookup risks looking like a dict (lead with fan-out, citation blast radius, PageRank, ballots); a strawman RAG baseline; the section mapping is unknowable.
→ Revised into docs/brief-standards-v2.md for a round 2.

# Council 5, 2026-10-13: rfc-brain v2 (Fable, blind)
| Advisor | Company Brain win % | Connected Data win % |
|---|---|---|
| Outsider | 8 | 10 |
| Expansionist | 18–25 | n/a |
| Contrarian | 5 | 7 |
| First Principles | 10 | 15 |
| Executor | 6–8 | 10–12 |
| **Average** | **~10%** | **~11%** |
Scores spread widely (graph 5–8, originality 5–8). No gain over v1 (10.6%): advisors' calibrated ceiling stays about 10–11%, the same as the cloud loop found.
Consensus fixes for v3:
- Make **Track 1 (Connected Data) the main track**; 4 of 5 advisors said the Company Brain fit is a stretch.
- Add a scanner classifier, because **"obsolete ≠ wrong"**: version-pinned, historical by design, or truly stale. Example false positives: curl's `RFC822.SIZE` IMAP token, and RFC 5246 cited correctly in a TLS 1.2 table.
- **Pre-measure demo repos.** curl has 148 RFCs and 98 lines in the obsolete family, per the Executor's local scan.
- **"Who decided" on RFC 9110** (15 ballots with comments), not 2616 (it predates ballots).
- **Cut embeddings to full-text** (current RFCs only, if at all).
- **Open with the ecosystem stale-citation leaderboard**, the graph-only query.
- **The action:** a draft PR on a fork, not just a report.
- **Resolve citation aliases** (bcp/std) via `contains`, and load in UNWIND batches.
