# Benchmark

scripted agents, same edit, real tsc, real FalkorDB conflict check.

Each trial copies `demo-repo`. Agent A has claimed `auth/session.ts`. Agent B's edit deletes the import in `ui/LoginForm.tsx` and leaves the call, so `tsc` fails if the edit lands.

| | Broken builds | What happened |
|---|---|---|
| Without Switchboard | 10 / 10 | The edit was applied every time |
| With Switchboard | 0 / 10 | The edit was blocked 10 / 10 times |

Median conflict check: **1 ms**.

The graph is the only difference between the two columns.
