# Night package N2: live data layer

Branch `night/n2`. Server for checks: port 8812, graph `sb_night_n2` (COMMON.md's port, not the brief's 8792).

## What changed

1. **apiUrl everywhere.** Every fetch and the EventSource go through `apiUrl()`. `json()` throws `Error(body.error ?? 'HTTP ' + status)`.
2. **Settled refetches.** `refresh()` is `Promise.allSettled` over graph, claims, decisions (+ batches only with `withBatches`). A failed call keeps its last good value. Data calls never set a status.
3. **Seq window.** Health's `seq` (0 when absent) sets `seqAtLoad`; the stream opens at `last=max(0, seq-40)`. `fresh = item.seq > seqAtLoad`. Items at or below `lastSeq` are dropped, which also dedupes overlapping polls.
4. **Reconnect.** On any stream error useLive closes the EventSource itself, shows `reconnecting`, waits 3 s, checks health, and reopens from `lastSeq` (or goes to replay if health fails). EventSource's own retry never handles HTTP errors such as a 530.
5. **Open on the last conflict.** 250 ms after the history burst, if no fresh hit played, `setHit({..., quiet: true})` from the newest history conflict.
6. **Paced beats.** Fresh events go through a queue applied one per 600 ms (immediately under `prefers-reduced-motion`). The refetch happens when an event *arrives*, coalesced at 250 ms, so a demo costs one refetch instead of one per beat (9 batch calls before this, 2 after).
7. **Replay fallback.**
   - `scripts/snapshot-replay.ts` records a real run on temp graph `sb_replay` and deletes it: `capturedAt, graph, claims, decisions, batches, demo, events, blast/why/check per file, brief per demo task`, plus `cypher` (same shape as N1's `/api/cypher`, built from the core module files). 27 KB.
   - When health fails, useLive fetches `/replay.json` from the web origin. Then status is `replay`, `replayAt = capturedAt`, the header's graph name is blank, and `api.*` answers from the file (health always goes live).
   - `api.demo()` re-emits the recorded events through useLive's handler with their original spacing, `at = Date.now()` and new seqs, so the conflict animates.
   - `api.claim` answers from `check[path]` and drops conflicts with the claimant's own claims (so A on session.ts is granted). `api.brief(task)` reads `brief[task]`. With no task it returns the first recorded brief (T1).
   - Recorded claim leases get shifted on load so they show the time left at capture, not an expired timer.
   - Health is polled every 10 s in replay or offline. On success useLive refetches, reopens the stream and returns to `live`. `retry()` checks immediately. Status is `offline` only when health fails and replay.json can't load.
8. **Polling fallback (kept, folded in).** After 4 s of SSE silence, useLive asks `/api/feed?last=lastSeq`. Only if the feed has events the stream never delivered does it switch to polling every 2 s. The switch is sticky, so reconnects poll too. A quiet stream re-arms instead of switching, so an idle graph no longer forces polling.
9. **/judge** does `location.replace('/app')`. Judge.tsx is deleted.
10. **vite.config.ts** proxy target is `http://localhost:${SERVER_PORT ?? 8787}`.

`rate` still returns a constant `[]` marked `@deprecated`.

## Deviations and things for the orchestrator

- **Merge N1 with or before N2.** Without `health.seq`, seqAtLoad is 0, so every history event counts as fresh and the whole history animates on load. My checks added `seq` through a Playwright route on `/api/health`.
- **Regenerate replay.json after merging N1 and N3**, since they change the scenario, lessons and `Batch.paths`: `npx tsx scripts/snapshot-replay.ts`.
- `Panels.tsx` calls `api.brief()` with no arguments. The live server answers 400 ("give task or prefix"). That's for N1 or N5. Replay answers with T1's brief.
- Dashboard's status-island effect also fires on quiet hits. That's N5's call.
- `style.css` is no longer imported by anything. I left it because it isn't in my file list. `App.tsx` and `GraphCanvas.tsx` were already unreferenced. All three can be deleted.
- The Judge.tsx deletion landed in commit e4921ef (the first useLive commit) rather than 799160d, because it was staged early.
- Known limit: if `/api/events` keeps failing while `/api/health` is fine, useLive retries every 3 s indefinitely and does not fall back to polling. Add a failure counter if a proxy ever does that.
- The 429 check needs `withBatches` on. Dashboard (N5) doesn't pass it yet, so I flipped it locally to `useLive({ withBatches: true })`, built, ran the check, then reverted with `git checkout` (never committed).

## Checks (real output)

Gates: `npm run typecheck` exit 0, `npm run lint` exit 0, `npm run build -w @switchboard/web` exit 0 (the existing "use client" warnings only).
`npx tsx scripts/snapshot-replay.ts`: `wrote .../apps/web/public/replay.json: 27 KB, 35 files, 9 events`. `GRAPH.LIST` afterwards has no `sb_replay`.

Playwright script kept in scratch (`scratchpad/night/n2/check.mjs`), against 8812 (replay via `vite preview` on 5212 proxying to 8812):

```
[batches429] batches calls (all 429): 2 nodes: 35 status: live            PASS
[events530] during 530: status reconnecting blocked SSE opens: 4 nodes: 35
[events530] live again after 2373 ms; demo POST 200
[events530] new events animate without reload: true                      PASS
[buffered] feed polls after 7 s: 2 status: live feed rows: 43
[buffered] polled events animate: true                                   PASS
[openOnConflict] orange path elements with no click: 1                   PASS
[clockSkew] Play animates with Date.now +5 s: true                       PASS
[judge] landed on http://localhost:8812/app                              PASS
[replay] replay after 6667 ms; nodes: 35
[replay] Play animates the recorded path: true
[replay] Try a claim answer: Refused. ui/LoginForm.tsx → api/login.ts → auth/session.ts reaches Agent A's claim.
[replay] live again 8988 ms after restart                                PASS
```

No page errors in any run. Screenshots (1440x900): `scratchpad/night/n2/open-on-conflict.png`, `replay.png`, `replay-play.png`, `replay-claim.png`.
