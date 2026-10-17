# Demo video shot list (2:00 at most)

The owner's voice. Captions are burned in. About 2.5 words a second, so each line fits its slot. Every number comes from [`README.md`](../README.md) or [`bench/results.json`](../bench/results.json). What you may and may not claim is in [`JUDGE-QA.md`](JUDGE-QA.md).

| Time | On screen | Say | Burned-in caption |
|---|---|---|---|
| 0:00 | A real Claude Code session as agent B. Agent A already holds `auth/session.ts`. Ask it to edit `demo-repo/ui/LoginForm.tsx`. The PreToolUse hook denies the edit and the reason shows the import path. | "Claude Code tries to edit the login form. Switchboard refuses, and the reason is the import path, not a filename." | A file lock would have said yes. |
| 0:08 | The landing hero. | "Agents share a repo. A file lock sees filenames. Switchboard parses the imports into FalkorDB, so it sees that this form reaches the session module through the login handler." | The import graph lives in FalkorDB. |
| 0:20 | `/app?play=1`. The ring on the refused file, the packet running down the path, then the caption card. | "Agent A claims the session file. Agent B asks for the login form. The graph refuses and draws the path: login form, login, session. One Cypher path query, and the card shows how long it took." | Two hops. Refused before the edit. |
| 0:45 | FalkorDB Browser on :3000, graph `sb_demo`. Paste the conflict query. | "This is FalkorDB Browser. The query is the one in the README. Same graph, same answer: two hops, three files." | The same query, in FalkorDB. |
| 0:58 | `/app`, switch on Parallel batches. | "The open tasks fall into groups. FalkorDB's connected-components algorithm finds them. Different groups can run at the same time, and nobody typed the groups." | algo.WCC: parallel batches. |
| 1:12 | End agent A's session. Start a new Claude Code session. The SessionStart briefing arrives before the first prompt. Fallback: the Brief tab in `/app`. | "Agent A is gone. I start a fresh session. Before I type anything, it is handed a briefing from the graph: nearby claims, decisions, lessons and recent edits." | Memory outlives the session. |
| 1:32 | `/app`, Inspect, why on `lib/crypto.ts`. | "Why does crypto.ts hash with argon2? The graph has the edit, the agent, the task, and the decision behind it." | why: edit, agent, task, decision. |
| 1:42 | The benchmark on the landing page. | "Ten runs. Each edit passes the compiler alone. Merged, the build breaks every time without the check, and never with it. The agents are scripted, not live." | 10 / 10 broken without. 0 / 10 with. |
| 1:54 | End card. | "Switchboard. FalkorDB is the only store." | Live demo, repo, blog: see the card. |

The end card shows: the project name, the live demo URL, the repository URL, "FalkorDB is the only store", and the two tracks (Agent Memory & Coordination, Agents That Act on Connected Data). The live demo URL is a placeholder until the domain is final.

## Pre-record checklist

1. **Start clean.** Run `npm run server` and open `/app`. Run `curl -s -X POST localhost:8787/api/demo > /dev/null` to get a fresh reset. It leaves agent A holding `auth/session.ts` for 30 minutes. Film within 30 minutes of the reset, or run it again.
2. **Keep your own hooks out of the filmed graph.** Claude Code and Cursor sessions in this checkout fire the same hooks, and the hooks write to whichever server they reach. Start a second server for a scratch graph, `SERVER_PORT=8790 SB_GRAPH=sb_dev npm run server`, and in every shell or app you use for anything except the filmed shots, set `SB_GRAPH=sb_dev` and `SB_URL=http://localhost:8790`. The filmed terminal keeps the defaults. Or set `SWITCHBOARD_OFF=1` everywhere else.
3. **Shot 0:00.** In the filmed terminal run `SB_AGENT=B claude` in the repo root. If agent A's claim is gone, run `npm run switchboard -- claim auth/session.ts --agent A --task T1 --intent "session ttl"`.
4. **Shot 0:45.** Build the query to paste: `echo "CYPHER agent='B' paths=['ui/LoginForm.tsx'] now=$(date +%s)000 $(curl -s localhost:8787/api/cypher | jq -r .conflict)" | pbcopy`. Paste it into FalkorDB Browser on the `sb_demo` graph. If the Browser rejects the `CYPHER` prefix, show the same text in the Cypher drawer of the `/app` Inspect tab.
5. **Shot 1:12.** Put a handoff note in the graph first, so the briefing has something to say: `npm run switchboard -- handoff T1 --to B --agent A --note "session ttl is half done"`. The demo reset already records the codegen lesson, so don't add it again. The handoff note shows in the Brief tab and in `npm run switchboard -- brief T1`, not in the session-start briefing. Cursor drops session-start output, so use Claude Code for this shot.
6. **Screen.** 1920 by 1080, dark mode, notifications off, one monitor. The video is 1:55 to 2:00, with no cuts to a black screen.

## Do not say

- That the benchmark used live model agents. It did not.
- That we used Switchboard to coordinate its own build. We did not, beyond one parse of our own repo (see [`JUDGE-QA.md`](JUDGE-QA.md)).
- That it handles any language or any repository size. It reads TypeScript imports, and it was run on a 35-file demo repo and on `apps/web/src`.
- That the AI wrote nothing. Say what the README says.
