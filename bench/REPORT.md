# Benchmark

Scripted agents, two edits that each typecheck alone, real tsc, real FalkorDB claims. Reproduce with `npm run bench` (FalkorDB on localhost:6379; `BENCH_N` sets the run count; the graph is `sb_bench`, dropped afterwards).

## The scenario

Agent A holds `auth/session.ts`. Agent B wants `ui/LoginForm.tsx`. The two files are 2 import hops (ui/LoginForm.tsx → api/login.ts → auth/session.ts) apart, and `api/login.ts` declares `label: ReturnType<typeof sessionLabel>;`, so a change to `sessionLabel`'s return type reaches B's code.

- A's edit, `auth/session.ts`: `sessionLabel` returns `{ user: string; at: string }` instead of a string.
- B's edit, `ui/LoginForm.tsx`: appends `+ " · " + result.label.toUpperCase()`.

Each edit is run through the real TypeScript compiler (Version 5.9.3) on a fresh copy of `demo-repo` (35 files, 51 imports):

| Tree | tsc |
|---|---|
| Untouched repo | green |
| A's edit alone | green |
| B's edit alone | green |
| Both edits merged | red: `ui/LoginForm.tsx(9,67): error TS2339: Property 'toUpperCase' does not exist on type '{ user: string; at: string; }'.` |

Neither agent touches the other's file and neither edit is wrong on its own. The collision exists only in the merge.

## The two columns

- **Without Switchboard**: a plain file lock, which refuses only a path someone already holds, and no check before merge. B asks for a different file, gets its lock, both agents finish and both edits land. tsc runs on the merge. This is the setup the README warns about, not the best one without Switchboard: a CI run of tsc on the merge would also catch the break, but only after both agents have finished.
- **With Switchboard**: A claims `auth/session.ts` through `claim()` on a real FalkorDB graph. B's claim on `ui/LoginForm.tsx` is refused, because A's file is within 3 import hops of it. A's edit lands and A releases. B's claim now succeeds, B applies its edit on top of A's and runs its own tsc, which is red, so B's edit does not land. tsc then runs on what did land.

| | Broken builds | When the clash shows up | What happened |
|---|---|---|---|
| Without Switchboard | 10 / 10 | After both edits land, in a build of the merge | The lock allowed B 10 / 10 times, both edits landed |
| With Switchboard | 0 / 10 | Before B writes: its claim is refused with the import path | B's claim was refused 10 / 10 times; B's own tsc caught the collision after the rebase 10 / 10 times |

## What Switchboard saves here

Not the broken build as such: any check before merge keeps it out of `main`. What changes is when B finds out. Without Switchboard, B does its work in parallel with A on code that is about to change, and learns from a red build after both are done, so its change is reworked on top of A's. With Switchboard, B is refused before it writes a line, the refusal names the import path to A's file, and B starts from A's edit once it lands. The benchmark counts the refusals; it does not time the rework.

## Check latency

`findConflicts`, the read-only path query inside every claim: median **0.69 ms**, range 0.56–1.35 ms over 10 runs. The whole refused `claim()` call (check, a conflict event written to the graph) has a median of 3.64 ms.

## What this does and does not show

- The run is deterministic. Every trial repeats the same steps on the same files, so 10 runs show repeatability (the same result every time, a latency range), not a statistic.
- The agents are scripted, not live LLM sessions. B "waits" and A "releases" by direct calls in sequence, not real concurrency.
- The latency is the one measured, noisy number (this run: 1-minute load average 4.84 on 10 cores). The build counts are the same every run by construction; what they prove is that the two edits really do collide under the real compiler and that the claim graph really does refuse the second one.
- Without Switchboard the collision would show up in CI or on the next build. What it costs is a red main branch, a debugging session and B's rework, not lost data. The benchmark does not model that cost, and it does not include a CI arm.
