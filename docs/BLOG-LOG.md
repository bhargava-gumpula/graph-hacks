# BLOG-LOG: raw material for the Switchboard blog post (AirPods prize)

Add an entry whenever something blog-worthy happens. Format: `## <date time> — <title>`, 2–5 lines, plus the asset path in docs/blog-assets/.

## 2026-10-13 — How we picked the idea: ~150 AI advisors, one graph
We ran blind "councils" of five AI advisors (Contrarian, First Principles, Expansionist, Outsider, Executor) per idea, each doing its own web research. No idea ever scored above about 10–11% to win. Calibrated advisors are humbling. The owner picked Switchboard because it's the problem they live every day: running several AI coding agents on one repo.

## 2026-10-13 — The one query that justifies the graph
`MATCH p=(f:File {path:$mine})-[:IMPORTS*1..3]->(t)<-[:CLAIMS]-(a:Agent) RETURN p`. If it returns a path, two agents are about to collide through a dependency chain that no file lock would catch. If it returns nothing, that empty result *is the proof* that they can safely run in parallel.

## 2026-10-14 23:15 — The first worker agent got stuck, and git was our safety net
The first Grok worker built the scaffold, committed it in two clean steps, then got caught in a loop and was stopped before it could report. Because the rule is "one branch per task, small commits", nothing was lost: the orchestrator read the commits, re-ran every check itself and fixed one gap (tests weren't type-checked). Lesson: never trust an agent's report. Trust the branch and re-run the checks.

## 2026-10-15 00:10 — One bash script hard-blocked two different AI editors
A 40-line probe script told Cursor and Claude Code that `BLOCKED.md` was "claimed by another agent". Both editors refused the edit and passed our reason to the agent, which stopped and reported it instead of retrying. Two surprises: Cursor also runs Claude Code's hook config, so one edit was checked twice; and Cursor runs the session-start hook but drops what it returns, so briefings have to be pulled through an MCP call instead of pushed. Evidence: the `/tmp/sb-hooks.log` lines in DEVLOG (B1).
