# Switchboard: agent instructions (Cursor reads this automatically)

You are working on **Switchboard**, our entry for Graph Hacks (WeMakeDevs × FalkorDB, Oct 14–18 2026; submissions close **Sun Oct 18, 11:29 AM PT**).

**Before doing anything, read `docs/PLAN.md` §17** (the execution manual: current state, model policy, worktrees, task bundles, the review gate, goal checks, logging). Then read `docs/DESIGN.md` and the docs your task names. (The hackathon's task briefs and status notes are on the `archive/process` branch.)

Non-negotiables:
- **Always work towards the goal** (PLAN §17.8) and run the goal check at every checkpoint.
- **Only touch the files your brief lists;** stay on branch `hack/<id>`; never commit to `main` directly.
- **FalkorDB is the only data store.** Every Cypher query lives in `packages/core/src/queries/*.ts`, with a test against a real FalkorDB.
- **No secrets in git.** No product code was written before Wed Oct 14, 11:31 AM PT (hackathon rule).
- **Models:** main chat Claude Opus 5.5; subagents and small tasks Grok 4.7; big tasks Opus 5.5.
- **Finish every task with:** a summary, `git diff --stat main`, the test output, and a DEVLOG note.
- **Keep the code simple and explainable.** The owner must be able to explain the graph model, the queries and the architecture to the judges.
