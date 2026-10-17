# Benchmark

scripted agents, same edit, real tsc, real FalkorDB conflict check. Reproduce with `npm run bench` (FalkorDB on localhost:6379, `BENCH_N` sets the run count).

Each trial copies `demo-repo` and runs real `tsc` (Version 5.9.3) on it. Agent A has claimed `auth/session.ts`. Agent B's edit deletes `import { login, loginHeadline } from "../api/login";` from `ui/LoginForm.tsx` and leaves the call, so `tsc` fails if the edit lands. The untouched repo typechecks (the control).

| | Broken builds | What happened |
|---|---|---|
| Without Switchboard | 10 / 10 | The edit was applied 10 / 10 times |
| With Switchboard | 0 / 10 | The conflict check blocked the edit 10 / 10 times |

Conflict check (`findConflicts`, one FalkorDB path query): median **0.65 ms**, range 0.58–0.83 ms over 10 runs.

The graph is the only difference between the two columns. These are scripted agents, not live LLM sessions.
