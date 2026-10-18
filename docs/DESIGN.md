# Design decisions and why

Each decision below has the choice, the reason, what it costs, and where to check it. The reasons come from the plan ([PLAN.md](PLAN.md) §0.6, §2.1, §3, §4, §9 and the owner answers in §18), the engineering log ([DEVLOG.md](DEVLOG.md)) and the code. Where a choice came from a review rather than from the owner, it says so.

The owner set two requirements: FalkorDB is the only store, and a claim is checked against the dependency graph parsed from the code, not against a list of file names. The rest follows from those two.

## 1. Why a graph

**Choice.** Store the import graph, the agents' claims and their history in one FalkorDB graph, and ask the conflict question as one path query.

**Why.** The question is "does the file I want reach a file someone else is changing?". The answer is a path of unknown length between two sets that keep moving: my files and everyone else's live claims. In Cypher that is one pattern, `(f)-[:IMPORTS*1..3]->(g)<-[:CLAIMS]-(o)`, and the path comes back with the row, so the refusal can show it. In SQL it is a recursive CTE per direction with a path column built by hand. A lock table only compares names, so it never sees `LoginForm.tsx` and `session.ts` meet.

**Cost.** Everything stops when FalkorDB is down. The hooks then fail open and let the edit through.

**Where.** `packages/core/src/queries/conflict.ts`. PLAN §4 Q1 and §9 question 9.

## 2. Why file-level imports

**Choice.** A node is a file, and an edge is "this file imports that file". Only TypeScript and JavaScript are parsed, with ts-morph.

**Why.** The plan put symbols (`Symbol`, `DEFINES`, `CALLS`) in the model but in the polish tier. File imports were what one parser could get right reliably in four days, and they were enough to catch the collision the demo is about (PLAN §9 questions 17 and 18).

**Cost.** Two agents editing different functions in one file still conflict. Two files that share only a database table or a config value never do. The `IMPORTS` edge already stores the imported names (`specifiers`), so symbol-level checks are the next step, not a rewrite.

**Where.** `packages/core/src/parser.ts`, `packages/core/src/queries/loader.ts`.

## 3. Why 3 hops

**Choice.** A conflict path is at most 3 imports long by default. `SB_HOPS` sets 1 to 5.

**Why.** The plan set k = 3 (PLAN §4). One hop misses real chains: in the demo repo, 72 file pairs are linked within 3 hops, and 24 of them are 2 or 3 hops apart, so a one-hop check misses them (`npm run pairs`). The demo collision itself is 2 hops (`LoginForm.tsx → login.ts → session.ts`). A bound also keeps the query cheap, and Cypher cannot take a variable-length bound as a parameter, so the number is checked to be an integer from 1 to 5 and written into the query text.

**Cost.** A collision 4 or more imports apart is not caught, and more hops means more refusals. 3 is a judgment call, not a measured best value: how often it refuses an edit that would have been fine is not measured.

**Where.** `hops()` and `MAX_HOPS` in `conflict.ts`.

## 4. Why claims with a TTL

**Choice.** A claim is a `CLAIMS` edge with an `until` time, 30 minutes by default. Each edit renews it. The session-end hook releases it.

**Why.** An agent can crash or be killed before it releases anything, and then its session-end hook never runs. With a TTL a dead agent's claim expires on its own instead of blocking everyone. Before each new claim, `claim()` also releases the claims of any agent not seen for 30 minutes, in case one set a longer TTL. The conflict query filters on `until`, and an index on `CLAIMS(until)` is where its query plan starts.

**Cost.** A live agent that goes quiet for 30 minutes loses its claim. Claims also end on session end or expiry, not on merge, so a worktree can still be behind the commit that freed the file.

**Where.** `DEFAULT_TTL_MS` in `packages/core/src/queries/claims.ts`, `releaseStaleAgents` in `agents.ts`. PLAN §3 and §9 question 15.

## 5. Why hooks and MCP

**Choice.** Editor hooks enforce the check on every edit. The MCP server is for what an agent asks for on purpose: a brief, a decision, a handoff, an explicit claim.

**Why.** An agent forgets instructions, so the check cannot depend on it calling a tool. The day-0 tests on Oct 15 (the owner ran the Cursor steps) showed that both Claude Code's `PreToolUse` and Cursor's `preToolUse` can deny an edit and show the agent our reason, and that Cursor ignores what its session-start hook returns. So the deny is a hook in both editors, and the brief is also an MCP tool (`brief_me`) for Cursor. The MCP tools work in any client, so they are the contract for an agent with no hooks (PLAN §2.1, DEVLOG B1).

**Cost.** Where the editor runs no hook, a claim is advice. Shell commands are claimed only for obvious write targets (redirections, `tee`, `sed -i`, `mv`, `cp` and similar).

**Where.** `packages/hooks/src/hook.ts`, `packages/hooks/src/shell.ts`, `packages/mcp/src/index.ts`.

## 6. Why PageRank hubs

**Choice.** A file is a hub when 10 or more files import it, or when at least 3 do and its PageRank score is at least 4 times the average. A conflict path may not pass through a hub. A claim on the hub itself still conflicts.

**Why.** Almost every file imports something like `lib/utils.ts`. If a path through it counted, every claim would conflict with every other (PLAN §4 Q6 and §9 question 11). PageRank over `IMPORTS` is one built-in call, `algo.pageRank`. We also tried `algo.betweenness` with the same kind of rule. On the demo repo it also flagged `api/notes.ts` and `api/users.ts` and dropped 10 of the 72 linked pairs, so we kept PageRank (README, Limits).

**Cost.** Two files that share only a hub never conflict, even when a change to the hub's behaviour affects both. The thresholds were tuned on the 35-file demo repo.

**Where.** `packages/core/src/queries/hubs.ts`.

## 7. Why one graph per visitor on the public demo

**Choice.** On the public site each visitor gets a `GRAPH.COPY` of the demo graph. An idle copy is deleted after a while. Past a cap, visitors share the template.

**Why.** Before this change, one judge pressing Play or Reset changed what every other judge saw. The blind review on Oct 17 asked for per-visitor demo graphs (DEVLOG, 15:10 entry), and they were merged in `85aebf2`. The public server also runs on its own graph (`sb_public`), so local hooks and the CLI never write into it (DEVLOG, 10:50 entry).

**Cost.** One copy per visitor costs memory, hence the idle sweep and the caps. People behind one shared IP can end up sharing a graph.

**Where.** `apps/server/src/visitors.ts`.

## 8. Why the guard and the claim are one Cypher write

**Choice.** `claimQuery(k)` is the conflict guard followed by the write, in one query. The guard returns one row when nothing conflicts and no rows otherwise, so the write runs only when the claim is free.

**Why.** FalkorDB runs the write queries of one graph one at a time. If the check and the write were two queries, two agents asking for linked files at the same moment could both pass the check and both write. When the engine was rebuilt on Oct 17, real races like this were found and fixed (DEVLOG, 02:15 entry). The test `ten agents race for the same file: one holder` fires ten claims at once, and exactly one wins. The event counter `seq` uses the same trick: the bump and the event are one write, so 20 concurrent events get exactly 1 to 20 (DEVLOG B3).

**Cost.** The guard repeats the conflict query inside the write, so a claim costs one path query. On the demo repo FalkorDB runs that query in about 0.2 ms (README, What the plan looks like).

**Where.** `claimQuery` and `WRITE_CLAIMS` in `claims.ts`, `conflictGuard` in `conflict.ts`.

## Smaller decisions

- **No model in the decision path.** The conflict check, the rounds and the why-trace are queries. The only model call is an optional Claude Haiku summary on top of a brief, which the owner chose on Oct 14 (PLAN §0.6, F20). It runs only when `ANTHROPIC_API_KEY` is set.
- **Rounds instead of WCC.** We first split tasks with `algo.WCC`. A connected component runs a chain A-B-C one task at a time even though A and C never touch, and WCC needed stored edges, so reading the schedule had to write to the graph. Greedy colouring puts A and C in one round and writes nothing ([JUDGE-QA.md](JUDGE-QA.md) question 3).
- **A refusal leads to a wait.** A refused agent waits on the file that blocked it (`WAITS_FOR`). The holder is told someone is waiting, and the waiter is told when the file is free (`packages/core/src/queries/waits.ts`). This came from the same review: a plain refusal left the agent with nothing to do next.
