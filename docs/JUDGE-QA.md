# Judge Q&A: the truth sheet

Twelve questions, each answered in at most two sentences. Every answer was checked against the code or the logs named in it. If a fact here and the code disagree, the code wins: fix this file.

## 1. Why a graph and not SQL?

Conflict, blast radius and the why-trace are paths of unknown length between moving sets of files. A recursive CTE can walk imports, but you write one per direction and build the path column yourself, while FalkorDB returns the path from `-[:IMPORTS*1..3]->` and runs `algo.pageRank` and full-text search in one call each.

## 2. How does the conflict query work?

For each file an agent asks for, it looks for another agent's live claim on the same file, on a file the request imports within 3 hops (UPSTREAM), or on a file that imports the request within 3 hops (DOWNSTREAM), and any row is a refusal that carries the path. A hub in the middle of a path is ignored, and an empty result means no live claim sits within 3 hops.

## 3. How are tasks split into rounds, and why not WCC?

One read query finds every pair of open tasks whose files sit within 3 import hops of each other, by the same rules as the claim check. The task with the most of those links goes first, and each task takes the lowest round its neighbours leave free. Tasks in a round can run at the same time; round 0 runs first. We used `algo.WCC` at first. A connected component runs a chain A-B-C in turn, though A and C never touch, and WCC needs stored `INTERFERES` edges, so reading the schedule had to write. Rounds put A and C together, and reading them writes nothing.

## 4. What is the exact hub rule?

A file is a hub when 10 or more files import it, or when at least 3 files import it and its PageRank score is at least 4 times the average (`packages/core/src/queries/hubs.ts`). On the demo repo only `lib/utils.ts` is a hub, with 20 importers; a path never passes through a hub, but a claim on a hub itself conflicts with its importers.

## 5. What does the benchmark show, and what does it not?

Ten times it copies the demo repo and applies two edits that each pass `tsc` alone (agent A in `session.ts`, agent B in `LoginForm.tsx`): with a file lock and no check before merge both land and the real compiler fails 10 of 10 times, and with Switchboard B's claim is refused before it writes a line, B waits for A, and B's own `tsc` on top of A's edit stops its edit, so 0 of 10 builds break (`bench/results.json`). A CI check on the merge would also keep the build green, only after both agents had finished, so what it shows is when B finds out, not that nothing else could catch it; and it does not show how often real agents collide, because the agents are scripted, it is one scenario, and it is deterministic.

## 6. Did you use Switchboard to build Switchboard?

No, not beyond parsing our own repo once (60 files and 81 imports on Oct 15). The build was coordinated with task briefs, one git worktree per task, and review and merge by the main chat.

## 7. Who wrote what?

AI coding agents wrote almost all of the code: Cursor with Claude Opus 5.5 and Grok 4.7, and Claude Code with Claude Opus 5.5. The owner made the product decisions in `docs/PLAN.md` §0.6 (the idea, the two tracks, FalkorDB as the only store, checking claims against the parsed import graph, the AI briefing summary, the benchmark), ran the editor tests that needed a person, and directed the UI rebuild, while the main Opus 5.5 chat wrote the task briefs and reviewed and merged the branches; `docs/DESIGN.md` gives the reason for each design choice.

## 8. What breaks without FalkorDB?

Everything the product does, because FalkorDB is the only store: the claim check, the event feed (the `seq` counter lives in the graph), the rounds, the why-trace and the briefing all stop. The web app then shows a recorded run, labelled as a recording.

## 9. What happens when two agents claim at once?

A claim is one write query that runs the conflict guard and the write together, and FalkorDB runs the write queries of one graph one at a time, so two racing claims cannot both pass the check. The test `ten agents race for the same file` fires ten claims at once and exactly one wins.

## 10. What memory types does it keep?

Episodic memory is `Event` nodes (`BY`, `ON`, `UNDER`) numbered by a gap-free `seq`, and semantic memory is `Decision` with `AFFECTS` and `SUPERSEDES`. Procedural memory is `Lesson` with `ABOUT`, and shared state and handoffs are `CLAIMS`, `WORKS_ON` and `HANDED_OFF`, with one graph per project for separation.

## 11. What are the limits?

It reads TypeScript only (static imports, re-exports and `import("literal")`), works at file level, looks at most 3 import hops by default, and ignores a path that runs through a hub. After each agent edit that file's imports are updated in the graph, and `switchboard watch` catches saves people make, so the graph stays live without a full parse. A claim blocks an edit only where the editor runs the hook.

## 12. How is it deployed?

The server and FalkorDB run on the owner's Mac behind a named Cloudflare Tunnel at https://switchboard-agents.xyz. One server process serves both the built web app and the API, in public mode (`SB_PUBLIC=1`: agents A to D only, paths must already be in the code graph, short leases), and each visitor plays on their own copy of the demo graph. If the API can't be reached, the dashboard switches to a recorded FalkorDB run and labels it Replay. The steps are in `deploy/RUNBOOK.md`, and a GitHub Actions job pings the site and the API every 15 minutes.

## Numbers you can quote

| Fact | Value | Where to check |
|---|---|---|
| Demo repo | 35 files, 51 import edges | `npm run parse -- demo-repo` |
| Importers of `lib/utils.ts` | 20 | the `MARK_HUBS` result |
| Conflict query, inside FalkorDB | about 0.2 ms (median 0.17 ms over 25 runs) | `GRAPH.PROFILE`, see the README |
| MCP tools | 15 | `packages/mcp/src/index.ts` |
| First code commit | Oct 14, 11:09 PM PT, after the 11:31 AM PT start | `git log --reverse` |
