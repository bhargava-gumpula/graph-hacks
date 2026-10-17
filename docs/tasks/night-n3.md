# Night N3: graph semantics and real-agent integration

Branch `night/n3`, worktree `~/Projects/gh-night-n3`. Graph `sb_night_n3`, port 8813 (the orchestrator's port; the brief said 8793), tests with `SB_TEST_NS=_n3`.

## What changed

1. **Paths.** `normPath` (packages/core/src/paths.ts) strips an absolute repo root (`SB_ROOT`, else this checkout), a leading `./` and `${SB_PREFIX ?? 'demo-repo'}/`. Used by claim, release, findConflicts, recordEdit/recordEditAndCheck, whyTrace and blastRadius. `claim()` no longer MERGEs files the parser never saw: they come back in `unknown`, and known paths in the same request are still checked and claimed. `unknownPaths(g, paths)` is exported for the CLI's `check`.
2. **Hub rule.** `none(n IN nodes(p)[1..-1] WHERE coalesce(n.hub,false))` in Q1 (NO_HUB, so conflictQuery and conflictGuard), interfereQuery (both filters), NEAR_FILES and blastQuery. FalkorDB accepts the negative slice; a test proves `nodes(p)[1..-1]` drops exactly the two ends. A claimed hub now conflicts with its importers. `/api/check?path=lib/utils.ts&agent=B` with A on session.ts now returns DOWNSTREAM `auth/session.ts → lib/utils.ts`, hub: true.
3. **why.** One row per (agent, task, decision) with the newest seq and `edits` (count). `nodes: {label, id}[]` is the chain's real graph nodes (File, Agent, Task, Decision). A second UNION arm answers for an active decision that governs the file with no tracked edit. All OPTIONAL MATCHes come before the aggregation: in FalkorDB an OPTIONAL MATCH with a property filter right after an aggregation found nothing.
4. **brief.** `Recent edit` deduped per path, newest kept. Also: `prefix: ''` now means the whole repo (core used `prefix || null`, so `''` gave an empty briefing even after the CLI fix), and the `Files:` line shows 8 files then `(+N more)`.
5. **schedule.** Each `Batch` has `paths`, sorted.
6. **snapshot.** Agent nodes carry the stored kind as `agentKind` (see deviations).
7. **CLI.** `brief --prefix ""` works. `check` prints `OK no claim within 3 import hops (X ms)`. `claim` prints `OK until=<ISO> (N files checked within 3 import hops)`. Unknown paths print `WARNING not in the parsed graph, no dependency check: <path>` (on their own, no OK line).
8. **MCP.** Server `instructions` (the brief's text), brief_me defaults to prefix '' and caps `structuredContent.brief.events` at the 5 newest distinct (kind, path, agent), claim returns `unknown` and prints the warning, batches carry `paths`.
9. **hook.sh.** `pre` POSTs /api/claims (fallback `cli claim`, exit 2 = conflict) and denies with the multi-line reason (import path, holder, task, intent, free in N min). `rel` is computed against `SB_ROOT` or the agent's git top level. Matcher `Edit|MultiEdit|Write|NotebookEdit`, reads `notebook_path`. `start` uses `/api/brief?prefix=` then the CLI. `end` releases the agent's claims (CLI; 8 s timeout). No jq: logged, and the SessionStart context says Switchboard is off. An allowed file the parser never saw gets a Claude `systemMessage` warning.
10. `sb-echo` removed from both MCP configs; `scripts/mcp-echo.ts` deleted; `.cursor/mcp.json` uses `${workspaceFolder}`. `.cursor/hooks.json` gained `sessionEnd`.
11. `scripts/try-agent.sh`.
12. **STRETCH.** A denied claim returns `safe`: up to 5 open-task files for which Q1 finds nothing. The hook, the CLI and MCP print `Safe now: …`.

## Deviations from the contract

- **packages/core/src/index.ts edited** (the orchestrator asked for the query-text exports early). N1 added the same exports on ui/rebuild, so the merge will conflict on the conflict.js, claims.js and blast.js lines. Resolve by taking ui/rebuild's lines and adding `unknownPaths` to the claims line: `export { claim, claimQuery, release, unknownPaths, DEFAULT_TTL_MS } from "./queries/claims.js";`
- **`GraphNode.agentKind`, not `kind`.** `kind` already exists and means `"file" | "agent"` (core and the web `GNode`). Web (N5/N2) should read `node.agentKind` to show Cursor or Claude Code.
- **Extra additive fields:** `Conflict.until?: number` (for "free in N min"), `ClaimResult.safe?: string[]` (stretch), `WhyHit.edits`. `Conflict.hub` is true when the requested file or the claimed file is a hub.
- **`Batch.paths`** is the union of the tasks' footprints (TOUCHES plus active claims under the task), which is what the batching runs on, not TOUCHES alone.
- **blast.ts** uses the same interior-hub rule, so the rule is the same everywhere. No change on the demo repo, because lib/utils.ts imports nothing.
- **`WhyHit.nodes`** is the list of the chain's matched nodes, not literally `nodes(p)`. In this schema the edit's agent hangs off the Event, so File, Agent, Task and Decision are not one linear path.
- **try-agent.sh** adds `--strict-mcp-config`. Without it, haiku follows the MCP instructions, tries `mcp__switchboard__claim` (not in `--allowedTools Read,Edit`), is refused, and never edits, so the hook is never exercised. The verdict comes from `git diff`, and the trap also releases A.
- `scripts/mcp-echo.ts`'s deletion landed in commit 42a3de5 (the core commit), not the hook commit, because I staged it too early.

## Follow-ups for the orchestrator

1. **agents.test.ts (not mine) fails 2 tests** because it claims files in a graph with no File nodes. Verified fix (applied, passed 5/5, then reverted). In its `beforeEach`, after the DETACH DELETE line:
   ```ts
   // claim() only claims files the parser has seen.
   await g().query("UNWIND ['lib/crypto.ts', 'ui/AboutPage.tsx'] AS p MERGE (f:File {path: p}) ON CREATE SET f.hub = false, f.rank = 0.0");
   ```
2. `events.test.ts` "50 concurrent recordEvent calls" also failed on the baseline before any N3 change, with load average around 26. It's a flake under shared load, not N3.
3. After merging, restart the live server (8787, sb_demo): the hook's SessionStart calls `/api/brief?prefix=`, and the old brief() treats `''` as nothing.
4. Optional: a `POST /api/release` route would let `hook.sh end` skip the CLI (it is CLI-only today).
5. `conflictQuery`'s RETURN now also has `c.until AS until` and the hub expression, which matters to anything that displays the Cypher (N1 /api/cypher, N6 video).
6. Cursor's `sessionEnd` key is untested in Cursor itself. The Cursor `preToolUse` matcher is still `Write`.
7. `hook.sh pre` now writes a 30-minute claim for every allowed edit, under SB_AGENT or the git branch.

## Results (real output)

- `SB_TEST_NS=_n3 npx vitest run packages/core packages/cli packages/mcp`: `Test Files 2 failed | 19 passed (21)`, `Tests 3 failed | 145 passed (148)`. The 3 failures are agents.test.ts (2, follow-up 1) and events.test.ts (1, follow-up 2). Every N3-owned test file passes. New tests cover (a) demo-repo/, ./ and absolute paths conflict, plus 0 `demo-repo/` Files; (b) an unknown path gives `unknown` and no File; (c) a claimed hub conflicts with its importers, an interior hub blocks nothing, and the claim guard follows the same rule; (d) 3 identical edits and 2 identical decision records give 1 why row (edits 3), plus the decision-only fallback; (e) batches carry paths. Also: MCP initialize has instructions, brief_me with no args, the hook's end/notebook/unknown/start paths, and Safe now.
- `npm run typecheck`: exit 0. `npm run lint`: exit 0.
- `npm run switchboard -- brief --prefix ""`: exit 0, starts `Files: api/audit.ts, … (+27 more)`. Note: run once without SB_GRAPH, so it read sb_demo. Read-only, no API key in env, so no summary call.
- `SB_GRAPH=sb_night_n3 npm run switchboard -- check ui/AboutPage.tsx`: `OK no claim within 3 import hops (1.6 ms)`.
- Hook against my server (8813, sb_night_n3): with A on auth/session.ts, B's PreToolUse for `<worktree>/demo-repo/ui/LoginForm.tsx` was denied with the full reason (path `ui/LoginForm.tsx ─imports→ api/login.ts ─imports→ auth/session.ts`, `held by A · task T1 "session ttl" · free in 30 min`). AboutPage was allowed, GET /api/claims showed B's claim, /api/feed and /api/events held the conflict event (seq 3, agent B). With the server down, the CLI fallback still denied. `hook.sh claude end` released B (`released 1`). Then I stopped the server by its port.
- `bash scripts/try-agent.sh`, a real `claude -p` with haiku: `DENY ui/LoginForm.tsx (20 s)` (haiku quoted the hook's reason), then `ALLOW ui/AboutPage.tsx (15 s)`. `git status --short demo-repo` is empty afterwards.
- `grep -rn sb-echo .mcp.json .cursor`: no output (exit 1).
