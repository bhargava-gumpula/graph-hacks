# night-n5: Dashboard /app, the 15-second story

Branch `night/n5`. Files changed: `apps/web/src/app/Dashboard.tsx`, `Panels.tsx`, `GraphView.tsx`, `apps/web/src/components/kokonutui/status-island.tsx`; deleted `apps/web/src/app/queries.ts`. `layoutGraph.ts` and `chart-stat-flow.tsx` needed no change.

## What a judge sees now
- **Coach line** before the first run: "Two agents, one repo. Press Play: watch the graph refuse an edit a file lock would allow."
- **Play**: the island shows "Running the demo", then "Refused ui/LoginForm.tsx · 2 hops to auth/session.ts (A) · {ms} ms" when the refusal arrives over the stream (no more "Demo finished" from the POST). The caption card (bottom left of the canvas) shows the server sentence with the last sentence ("A file lock would have allowed the edit.") emphasised, the path as chips, "caught in {checkMs} ms by one Cypher path query", and a Cypher disclosure (`/api/cypher`.conflict with `want = 'ui/LoginForm.tsx', $agent = 'B', IMPORTS*1..3, hubs not traversed`). Demo errors show the server's error text.
- **Tiles** (left column; a compact strip above the canvas below lg), hidden until the first refresh, latest run only: Collisions prevented (orange, backlit glow that flares when the count changes, NumberFlow via chart-stat-flow), Graph check {checkMs} ms, Parallel groups {n} (WCC). Footnote "{files} files · {imports} imports parsed" from the snapshot. LiveLineChart and the Ring are gone.
- **Feed**: the latest run (cut at the newest `parse`), older runs folded into "Earlier runs · n events" (expandable). Check-ins and releases are dimmed; check-ins name the tool ("from Cursor"). Conflict rows have a Cypher disclosure.
- **Agent B**: its card turns orange with "blocked: ui/LoginForm.tsx → held by A · 2 hops" (click selects the path: the claimed file, whose blast radius lights the route). The canvas draws a dashed ghost ring with a "B" badge on the refused file. Cards show "Cursor" / "Claude Code" under the name.
- **Parallel batches** (now live): `useLive({withBatches: batchMode})`; each group's `paths` tinted in neutral shades with G1/G2/G3 chips; legend "3 groups → 3 agents can work at once · t-login, t-session, t-settings must queue" derived from the data; Cypher disclosure with `/api/cypher`.batches.
- **Memory** tab (was Decisions): Decisions (semantic), Lessons (procedural: `lesson` feed events plus `api.brief(task).lessons`), Edits and events (episodic, latest run).
- **Brief** tab: task picker (claims' taskIds plus batch tasks, default T1), framed "What Agent A's replacement is told", rendered as label/value rows. Never calls `api.brief()` without a task.
- **Inspect**: why rows deduped by decisionId, drawn as File → Agent → Task → Decision with the edge names (edited by, under, caused by) and a line drawn with pathLength, 80 ms stagger. Cypher disclosures read `/api/cypher` (blast, why). `queries.ts` deleted.
- **Canvas**: radial `var(--bg)` gradient over `<main>` (the ASCII field shows only at the edges); quiet hits draw the path with no packet, impact or ripple; hover card anchored beside its node and clamped; label halos; hovered node grows and its edges light.
- **Honest states**: status goes into AgentsPanel and Feed; loading shows 2 agent-card and 6 feed-row skeletons; copy is keyed by status (only `live` says the stream is connected); replay banner "Live server offline. This is a recorded run: every path and number below came from FalkorDB at {replayAt}." with Retry → `live.retry()`; offline banner with Retry. No "npm run server" anywhere.
- **Try a claim**: A/B/C/D segmented control, files grouped by folder (`<optgroup>`), result as path chips plus an Inspect button; a grant selects the file.
- **Top bar at 390 px**: one line (`whitespace-nowrap`); Try a claim and Parallel batches are icon-only below sm/md, status text hidden below sm, Play reads "Play" below sm.
- **Status island**: a resting pill "Live · FalkorDB {dbMs} ms" (health polled every 15 s) or "Replay · recorded {time}". Done icon is neutral white, error icon is signal orange (one accent).
- **/app?play=1**: after the first refresh (live or replay) it plays once and `history.replaceState` drops the param.
- **First paint**: folder columns arrive left to right, nodes spring in and imports draw after their source (skipped under reduced motion). **Play clears the previous run's path** (and B's blocked row) so the new refusal draws on a clean graph; a failed Play restores it.
- **Stretch, all done**: (a) a wide invisible hit path on the orange route shows a card (file → claim, hops, ms, the UPSTREAM part of the conflict query) that follows the pointer; hovering an agent card lights its claims and their importers within 3 hops (client-side over the import edges, hubs skipped) and dims the rest; (b) the why trace above; (c) claim rings land with a spring.

## Decisions and deviations
- Port 8815 and graph `sb_night_n5` (per COMMON and the orchestrator), not the brief's 8795.
- The caption appears when the POST resolves (0.25 s delay), not when the SSE refusal lands: with N2's paced beats the refusal arrives about 5 s after Play, and the acceptance wants the caption at about 3 s.
- The status island moved inside `<main>` (top centre of the canvas), so it never covers the replay banner or the mobile tile strip. The batch legend sits below it.
- Before Play, "Graph check" and "Parallel groups" read "Press Play": checkMs only exists in the demo reply, and batches are fetched only in batch mode (or come with the demo reply). No number is invented.
- "Collisions prevented" counts `conflict` events since the newest `parse`, so a Try-a-claim refusal after a run counts too (it is a real refusal).
- The blocked agent comes from the conflict event's `agentId` (Hit only carries the holder). The tool name comes from the snapshot node when it carries `cursor`/`claude` (as `kind` or `agentKind`), else from the `register` event payload, which works today.
- `Batch.paths` absent → falls back to the claims of the group's tasks.
- On phones the caption sits above the tabs instead of over the 390 px canvas.
- Server batches arrive as `string[][]` in the demo reply today; the dashboard accepts both that and `Batch[]`.

## For the orchestrator
1. **useLive restarts the stream when batch mode toggles.** `refresh` depends on `withBatches` and the stream effect depends on `[refresh]`, so flipping Parallel batches clears the feed, re-lists the last 40 events and turns the hit quiet. Fix in useLive.ts (N2's file): keep `withBatches` in a ref so `refresh` is stable. Dashboard already calls `live.refresh()` when batch mode turns on, so nothing else is needed.
2. `rate` is no longer read by Dashboard; delete it from useLive.
3. `components/charts/index.ts` still exports LiveLineChart, Ring etc.; nothing in /app uses them now.
4. Integration was checked in a scratch worktree: `ui/rebuild` (7194538, with N1 and N2) + `night/n5` merges cleanly; typecheck and build pass; the Play flow logs no console errors once `/api/cypher` exists (on the bare n5 branch the only console error is that route's 404, and the Cypher disclosures hide themselves).

## Checks (real results, 2026-10-17 ~02:40 PT)
- `npm run typecheck` (all workspaces): pass. `npm run lint`: pass. `npm run build -w @switchboard/web`: pass (only the usual "use client" directive warnings). No unit tests cover apps/web.
- Playwright (script kept in scratch, not committed), against the integrated build on :8815:
  - `/app?play=1`: exactly 1 POST /api/demo, URL becomes `/app`.
  - 390x844: `scrollWidth` 390, header height 55 (one line).
  - `/api/health` never answering (loading) and all `/api/**` plus `/replay.json` aborted (offline): no live-connection copy; header reads "connecting" / "offline".
  - All `/api/**` aborted: replay banner, "replay" status, Play animates the recorded path and fills the caption.
  - Play flow, batches (mocked `/api/batches` with paths), Brief (no "Could not load the briefing"), Memory (3 sections), Inspect lib/crypto.ts (one argon2 row), hover card beside its node: no console errors.
- Screenshots (1440x900 and 390x844): scratchpad `night/n5/final/` (idle, play at 3 s and 6 s, batches, brief, memory, inspect, hover, plus replay, offline, loading, try, route hover, agent hover, Cypher open, mobile).
