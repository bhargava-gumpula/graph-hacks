# Night N1: demo can't fail (reset, single-flight Play, server hardening)

Branch `night/n1`, worktree `~/Projects/gh-night-n1`. Port 8811 and graph `sb_night_n1` (the orchestrator's numbers; the brief's 8791 was replaced by them).

## What changed

1. **resetDemo** (`packages/core/src/queries/loader.ts`). `RESET_DEMO_EXTRAS` is gone. `RESET_DEMO` is a list of single-step queries run one by one:
   non-demo File nodes (same predicate as before), every CLAIMS edge, every Agent but A and B, every EDITED edge, then every Event, Decision, Lesson and Task node.
   Kept: demo File nodes, IMPORTS, agents A/B, the Meta seq counter (seq stays monotonic).
   Verified that the scenario recreates every Task it uses: t-login, t-session, t-settings, t-prefs, t-about (planTask), T1 (A's claim), T2 (B's conflict event), T3 (recordDecision). So all Task nodes are dropped, which keeps `parallelBatches` deterministic. EDITED edges are dropped too because the scenario writes them again and they would otherwise grow by two per Play forever.
   Also added `missingFiles(g, paths)` (one MATCH, `FOUND_FILES`) for the public claim check.
2. **Single-flight Play** (`apps/server/src/index.ts`). `runDemo()` as specified. Two small additions: the reset+scenario is retried once if it throws (a claim that slipped in mid-run is the only realistic cause), and POST /api/claims waits for an in-flight Play before claiming.
3. **Demo content** (`packages/core/src/demo.ts`), appended after the existing T3 steps so the existing event order is unchanged: A records decision `session ttl 30m` (id D-session-ttl, task T1, affects auth/session.ts), A edits auth/session.ts under T1, A records lesson `run codegen before tsc` (id L-codegen) on lib/crypto.ts. lib/crypto.ts is 1 hop from session.ts, so brief(T1) lists it. lib/types.ts would read better but is 3 hops away and would not show. Story unchanged: A holds session.ts, B refused LoginForm at 2 hops, 3 batches.
4. **Static files.** index.html is read on every request. Any non-/api path with a file extension that serveStatic did not serve is 404. Unknown /api paths are 404. If dist has no index.html the shell route answers 503 "not built yet". The static handlers are always registered, so a build made after the server started is served.
5. **Rate limits.** `limit(n)` keyed on `cf-connecting-ip` + method + path; X-Forwarded-For is ignored; no cf header means local and never limited. demo 6, claims 20, brief 30, batches 60, edits 60 (kept from before), feed 120 per minute. Map is cleared past 5000 keys. `serve({ hostname: SB_HOST ?? '127.0.0.1' })`. `SB_RATE_LIMIT` is gone.
6. **Seeding.** Fresh graph (files = 0) runs the demo before listening. `lastWrite` is set by demo, claims, edits. Every 20 min, if idle for 10 min, `runDemo()`. No GRAPH.DELETE anywhere.
7. **SSE.** `retry: 3000` written once, `: ping` every 20 s, default start `max(0, latestSeq - 100)` when there is no `last` and no Last-Event-ID.
8. **/api/health** returns `{ok, graph, seq, files, dbMs, uptimeS, lastResetAt}`.
9. **/api/cypher** returns the 9 strings (conflict, guard, claim, blast, interferes, batches, hubs, why, brief). Core index now exports conflictGuard, claimQuery, blastQuery, interfereQuery, WCC_BATCHES, MARK_HUBS, WHY_TRACE, NEAR_FILES, resetDemo, missingFiles.
10. **Public mode** (`SB_PUBLIC=1`): POST /api/edits 404; claims only A-D (else 400); every path must already be a File (else 404 `{error:'not in the code graph', missing}`, nothing written); task and intent ignored; ttlMs 5 min.
11. **docker-compose.yml**: image pinned by digest, ports bound to 127.0.0.1. Not applied (no docker compose run).

`/api/feed` (orchestrator's polling twin) keeps its shape and gets the same treatment as `/api/events`: same default start, plus `limit(120)`.

`scripts/scenario.ts` (`npm run scenario`) now calls resetDemo before the scenario, so it matches POST /api/demo as its header says.

## Commands and real results

- `SB_TEST_NS=_n1 npx vitest run packages/core/src/queries/loader.test.ts packages/core/src/queries/feed.test.ts scripts/scenario.test.ts`: 3 files, 21 tests passed.
- `npm run typecheck`: all 5 workspaces clean. `npm run lint`: clean.
- `npm run build -w @switchboard/web`: built (only to serve and screenshot; no web source touched).
- Full suite `SB_TEST_NS=_n1 npx vitest run packages scripts apps`: 139 passed, 1 failed. The failure is `packages/core/src/queries/events.test.ts` "50 concurrent recordEvent calls…" and was already there: its 5 raw clients `connect({ graph: NAME })` without the SB_TEST_NS suffix, so they write to the shared, never-dropped `sb_test_events` and seq keeps growing across runs (got 151..200). Not my file; fix below.
- Concurrency, server on 8811: 8 parallel `POST /api/demo` gave `200` x8, and three more rounds of 8 also gave all 200.
- Vandal: deleted A's claim on my graph, `POST /api/claims {agent:'C', paths:['auth/session.ts']}` → ok:true; `POST /api/demo` → 200 with the refusal sentence; afterwards claims = [A on auth/session.ts], agents = [A, B].
- Rate limit: 7 POSTs with `cf-connecting-ip: 1.2.3.4` gave `200 200 200 200 200 200 429` (Retry-After 56). 10 POSTs with only `X-Forwarded-For: 6.6.6.6` gave all 200. Another cf IP is still allowed.
- Stale HTML: /app names `assets/index-BqQCGyW5.js`, which exists in dist and serves 200. To show it is read per request I appended a marker to dist/index.html: /app showed it at once, and after a rebuild it was gone. `/assets/nope.js` → 404, `/api/nope` → 404, `/app` and `/judge` → 200.
- Seed: server on fresh `sb_night_n1_fresh` was up in 2 s with health `files:35, seq:12` and claims `[A auth/session.ts]`. Then the graph was dropped with `g.drop()`.
- SSE: `curl -sN --max-time 24 /api/events` began with `retry: 3000` and showed `: ping` at line 51. It started at seq 306 with latestSeq 317: the start is 217, and lower events were removed by the reset.
- /api/cypher: 9 keys, all non-empty strings; `conflict === conflictQuery(3)` is true.
- Public mode: agent Z → 400; `ui/evil.tsx` → 404 `missing:["ui/evil.tsx"]`, File count 0; POST /api/edits → 404; D's claim with task/intent → stored with taskId null, intent null, 5.0 min TTL, and no Task 'pwn' was created.
- `lsof -nP -iTCP:8811 -sTCP:LISTEN` shows `TCP 127.0.0.1:8811 (LISTEN)` only.
- Screenshot of /app from the n1 server after Play: scratchpad `night/n1/app.png`. It renders, and the feed shows the new decision, edit and lesson events.
- All servers I started are stopped.

## For the orchestrator (outside my files)

- **Binding to 127.0.0.1**: the live server now binds IPv4 loopback only. `cloudflared tunnel --url http://localhost:8787` and Vite's proxy `http://localhost:8787` usually fall back from ::1 to 127.0.0.1, but `http://127.0.0.1:8787` is safer in `deploy/RUNBOOK.md` and `apps/web/vite.config.ts`. Run with `SB_PUBLIC=1` for the public link.
- **Web replay**: useLive opens `/api/events?last=0` and polls `/api/feed?last=0`, so it still replays from 0, not the last 100. The reset keeps history short (about 20 events per Play), so this is fine. To use the new default, open `/api/events` with no `last` the first time (apps/web/src/app/useLive.ts).
- **events.test.ts fix** (pre-existing): in `packages/core/src/queries/events.test.ts` line 10, change `connect({ graph: NAME })` to `connect({ graph: NAME + (process.env.SB_TEST_NS ?? "") })`. Dropping the stale shared `sb_test_events` graph once also makes it pass.
- `docker compose up -d` is needed to apply the compose pin and loopback ports. Same volume, so no data is lost.
- docs/api.md (not mine) should mention /api/cypher, the new health fields, the public-mode rules and the 404 for missing assets.

## Open / not done

- No cap on concurrent SSE connections per IP. Each stream polls FalkorDB every 500 ms, so a flood of streams is the remaining cheap DoS. Add a per-IP stream counter if that matters.
- The idle reseed was not run end to end, because waiting 20 minutes was not practical. The logic is three lines and runs the same `runDemo()` the tests cover.
