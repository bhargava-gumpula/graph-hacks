# Demo shot list

The owner's voice. About two minutes. The page at `/app` is the picture. Press **Play the demo** once before recording so FalkorDB is warm.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Landing page, the three numbers | "When several coding agents share a repo, a file lock only sees the filename." |
| 0:15 | Press Play the demo | "Agent A claims the session module. Agent B asks for the login form. Different files." |
| 0:30 | The sentence and the red path | "The graph says no. Login form imports login, which imports session. That path is the proof. The check took a fraction of a millisecond." |
| 0:50 | The three batch chips | "Which tasks can run together is a connected-components pass on the import graph. Three batches. Nobody typed the groups." |
| 1:10 | The decision chip, then Why on crypto.ts | "Why does this file hash passwords with argon2? Because a decision in the same graph says so." |
| 1:30 | `/judge`, press Conflict | "A judge can run the same three queries without the tour." |
| 1:45 | Close on the landing numbers | "Ten times, the edit that ignores the graph breaks the build. Ten times, the edit the graph blocks does not." |

If the live hook is the extra shot: set no `SWITCHBOARD_OFF`, claim `auth/session.ts` as A, and try to edit `demo-repo/ui/LoginForm.tsx`. The editor refuses with the same path.
