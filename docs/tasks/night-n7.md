# night-n7: honest benchmark, pair census, Proof section

Branch `night/n7` (base `bdb2eec`). Commits: `3044093` pair census, `090155b` benchmark, `3655390` Proof.

## What the benchmark now does (and nothing more)

Scenario, 2 import hops (`ui/LoginForm.tsx` -> `api/login.ts` -> `auth/session.ts`), same as N8's single scenario:

- `demo-repo/api/login.ts`: `label: ReturnType<typeof sessionLabel>` (type-only, imports unchanged; still a string).
- A's edit, `auth/session.ts`: `sessionLabel` returns `{ user: string; at: string }`.
- B's edit, `ui/LoginForm.tsx`: appends `+ " · " + result.label.toUpperCase()`.
- Controls, run first by real `tsc` (5.9.3), abort the run if red: baseline green, A alone green, B alone green. Merged is red: `ui/LoginForm.tsx(9,67): error TS2339: Property 'toUpperCase' does not exist on type '{ user: string; at: string; }'.`
- Without: a plain file lock (exact path match, an in-script function). B gets its lock, both edits land, tsc on the merge: red 10/10.
- With: real `claim()` on graph `sb_bench_n7` (default `sb_bench$SB_TEST_NS`, refuses `sb_demo`). A claims session.ts, B's claim on LoginForm.tsx is refused (10/10), A releases, B's retry succeeds, B applies its edit on top of A's and runs tsc: red 10/10, so B's edit does not land. tsc on what landed (A only): green, 0/10 broken.
- Not modelled: real concurrency (the "wait" is sequential calls), live LLM agents, B's rework after its tsc fails, and what a CI run would catch later without Switchboard. REPORT.md says so, and says the run is deterministic and N=10 shows repeatability, not a statistic.
- `checkMs*` times `findConflicts` alone (read-only check inside every claim). `claimMsMedian` times the whole refused `claim()`. tsc runs sequentially, never during a timed query.

results.json: kept `n`, `kind`, `without.brokenBuilds/editsApplied`, `with.brokenBuilds/blocked/editsApplied`, `checkMsMedian`, `tsc`, `node`, `ranAt`, `claim`, `edit` (so `video/src/scenes/Bench.tsx` and N8 keep working). Added `baselineOk`, `aAloneOk`, `bAloneOk`, `mergedOk`, `mergedError`, `with.caught`, `checkMsMin/Max/Samples`, `claimMsMedian`, `conflict {type,hops,path}`, `runs {without[], with[]}` (per-run outcome, drives the strips), `graph {files,imports}`, `loadAvg1m`, `cpus`. Dropped: `baselineTscOk` (renamed `baselineOk`) and `edit.removes`.

## The latency is load dependent (read this before the hero copy)

The build counts never change. The check latency does, because 8 agents share this machine. Runs tonight (median / range, 1 min load average at the end):

| run | median ms | range ms | load |
|---|---|---|---|
| 1 | 1.06 | 0.91-12.84 | 54 |
| 2 | 0.66 | 0.57-1.02 | 16 |
| 3 (committed) | 1.01 | 0.71-3.72 | 30 |

The earlier committed results.json (not mine) said 0.65. So "under 1 ms" is true on a quiet machine and false under load. `apps/web/src/landing/HeroGraph.tsx:246` hard-codes "Checked in under 1 ms", and `docs/STATUS.md` says "median 1 ms". Proof.tsx shows whatever results.json holds (2 decimals), so a loaded run prints "1.01 ms" next to the hero's "under 1 ms".

## Pair census

`packages/core/src/queries/pairs.ts` (`pairCensus`): unordered pairs of distinct files, fewest hops over `IMPORTS*1..3` in either direction, hubs skipped only as interior nodes (`nodes(p)[1..-1]`; FalkorDB accepts the negative slice), grouped by hop. `lock` is 0 by definition (a lock collides on equal paths; a pair is two different files), not measured. Test on a 15-file fixture (chain, hub, shortcut, 2-cycle, isolated file, empty graph).

`scripts/pairs.ts` -> `bench/pairs.json` (temp graphs `sb_pairs_demo$NS` / `sb_pairs_real$NS`, dropped after; verified with `GRAPH.LIST`). Median of 5 timed runs for `ms`.

| | files | pairs | lock | oneHop | graph | hidden | ms |
|---|---|---|---|---|---|---|---|
| demo (demo-repo) | 35 | 595 | 0 | 51 | 78 | 27 | 1.17 |
| real (apps/web) | 103 | 5253 | 0 | 185 | 321 | 136 | 2.75 |

Demo matches the council's 595 / 51 / 78 / 27 exactly. By hop, demo: 51 / 23 / 4; real: 185 / 95 / 41.

Deviations: (1) the brief says "ordered" pairs but expects 595, which is 35*34/2, so pairs are unordered (a conflict does not care who imports whom; in a DAG the dependent counts are the same either way). (2) `real` parses `apps/web`, not `apps/web/src`: the `@/*` alias lives in `apps/web/tsconfig.json`, and `parseRepo(root)` reads `root/tsconfig.json`, so parsing `src` would silently drop every `@/` edge and undercount.

## Proof.tsx

Reads `bench/results.json` and `bench/pairs.json` (bundled imports). Median in NumberFlow at 2 decimals on inView, `range {min}-{max} ms over {n} runs` (en dash, as the brief wrote it), 10-bar chart of `checkMsSamples` scaled to the slowest run (stretch, done), subtitle from `claim`/`edit`/`conflict.hops`, With caption exactly per brief, run strips (fg `tsc x` cells, orange `refused` cells, stagger 0.06 on inView, Phosphor X icon), census counters and the "27 of 78 ... a one-hop checker misses them, and a file lock misses every one" sentence, plus the same census on the web app. Orange text uses `var(--signal-text, var(--color-signal))`; inner glow on the With tile only. Reduced motion renders the final state (checked). The subtitle sentence "We merge both and run the real TypeScript compiler" is the brief's wording; in the With column the compiled merge is B's rebased tree, which is what stops B. The footnote states that the agents are scripted and the run deterministic.

Screenshots: `scratchpad/night/n7/proof-1440.png`, `proof-375.png`, `proof-1440-reduced.png`.

## Gates (real results)

- `npm run typecheck`: pass (all workspaces, no errors).
- `npm run lint`: pass (after fixing two `no-useless-assignment` in bench.ts). Note apps/web is lint-ignored.
- `npm run build -w @switchboard/web`: pass.
- `SB_TEST_NS=_n7 npx vitest run scripts/scenario.test.ts packages/core/src/queries/pairs.test.ts`: 2 files, 4 tests pass.
- `SB_GRAPH=sb_night_n7 npm run parse -- demo-repo`: 35 files, 51 imports.
- `SB_TEST_NS=_n7 npx vitest run packages/core scripts`: 133 pass, 1 fail: `events.test.ts` "50 concurrent recordEvent calls ... seq 1..50" got seqs starting at 301. It fails identically with my changes stashed (clean base), so it is not caused by this package. `GRAPH.LIST` shows a stray `sb_test_events` (no namespace suffix) that someone else created.
- `npm run bench` output: see bench/REPORT.md (baseline/A/B green, merged red, without 10/10, with 0/10, blocked 10/10, caught 10/10).
- `npx tsx scripts/pairs.ts`: lock 0 < oneHop 51 < graph 78 (demo), 0 < 185 < 321 (real); no temp graphs left.

## For the orchestrator (outside my files)

1. Re-run `npm run bench` on a quiet machine right before the final build, then `npm run build -w @switchboard/web` (the bundle embeds results.json). Run the benchmark with the machine idle: latency was 0.66 ms at load 16 and 1.01-1.06 at load 30-54.
2. `apps/web/src/landing/HeroGraph.tsx:246` says "Checked in under 1 ms." Derive it from `bench.checkMsMedian` (e.g. `${bench.checkMsMedian.toFixed(2)} ms`) or loosen it, so hero and Proof can never disagree. (N8 imports `checkMsMedian`.) The hero line "LoginForm.tsx reaches crypto.ts in 3 imports" differs from this scenario (session.ts, 2 hops): N8's switch to one scenario resolves it.
3. README.md lines ~89-92 and `docs/STATUS.md` (B15 row: "median 1 ms") describe the old benchmark (B deletes an import). Replacement text for the README: "Ten trials. Agent A holds `auth/session.ts`. Agent B's edit to `ui/LoginForm.tsx` passes on its own, as does A's, but merged they fail the real TypeScript compiler. Without Switchboard a file lock lets both land. With it, B's claim is refused, B waits for A, rebases, and its own tsc stops the edit. See `bench/REPORT.md`."
4. No `npm run pairs` script (package.json is not mine): run `npx tsx scripts/pairs.ts`, and re-run it if the web app's imports change a lot, then rebuild.
5. Servers I started on 8817 are stopped; graphs `sb_bench_n7`, `sb_pairs_*_n7` and `sb_night_n7` are dropped.
