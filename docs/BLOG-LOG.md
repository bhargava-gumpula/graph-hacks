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

## 2026-10-15 00:35 — The graph caught a bug in our own test data
The demo repo has two "independent" features so the scheduler can show they're safe to run in parallel. Checking the import graph by hand found they weren't independent: both imported one shared types file, so they were 2 hops apart, and a connected-components pass would have put them in one batch. A file-lock tool would never notice. A dependency graph notices immediately. Fix: the settings types moved into the settings feature's own file.

## 2026-10-15 10:30 — A file lock would have said yes. The graph said no, in 0.44 ms
Agent A claims `lib/crypto.ts`. Agent B asks for `ui/LoginForm.tsx`, a different file. A lock table would grant it. Q1 walked three IMPORTS hops and returned the path `LoginForm → login → session → crypto` as the proof they would collide. Empty result is also a proof: the settings island and `AboutPage` came back with no path, so they are safe. Median round-trip on the demo graph: 0.44 ms. The same path now arrives over SSE and lights red on the canvas.

## 2026-10-15 16:25 — One command is the whole MVP demo
`npm run scenario`: parse 35 files, agent A (Cursor) claims `auth/session.ts`, agent B (Claude Code) asks for `ui/LoginForm.tsx`. A lock table would say yes. FalkorDB returns `LoginForm → login → session` and refuses the claim. That is beats 1–2 of the video, replayable, tagged `v0.1-mvp`.

## 2026-10-15 17:15 — Which tasks can run together is a graph algorithm
Five open tasks. FalkorDB connects two when one's files can reach the other's through imports, skipping the hub everyone imports. Weakly connected components then returns three batches: the login chain together, the settings island together, and the about page alone. Nobody listed the batches. The import graph did.

## 2026-10-17 01:20 — Drawing the hero in code, not pixels
We threw away the first UI and rebuilt it around one idea from a reel: "code places, it doesn't predict." The hero isn't a video or a mockup. It's the real demo repo laid out in folder columns, with the actual 3-hop path FalkorDB returns, drawn as SVG and animated hop by hop. Asset: docs/blog-assets/hero-u1.png (to capture).
