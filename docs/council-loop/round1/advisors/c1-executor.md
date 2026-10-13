# Executor review: Candidate 1, dependency-aware traffic controller for parallel Claude Code agents

## SCORES (1–10)
- **Graph essential: 7.** The core check, "does this file reach a claimed file within 3 hops of IMPORTS/REFERENCES, and by which path?", is a variable-length traversal that returns a path. The graph does real work here. Claims and events alone could live in Redis or SQLite, which is why this is not an 8.
- **Demo memorability: 6.** Seeing a denied edit come back with the exact dependency path, drawn live on a canvas, is a strong visual. But "agents waiting their turn" is a calm demo, and three agents running live will behave differently on every take.
- **4-day feasibility for one builder: 5.** Hooks, claims and the blocking path are about 1.5 days of work. TypeScript symbol resolution, parallel-safe task sets, briefings, the "why" trace, the live canvas, deployment and the README, all on top of that, over-promise for 4 days.
- **Originality vs competitors: 5.** File locks for parallel Claude Code agents already exist several times over. The new part is blocking on transitive dependencies rather than on the file itself.
- **Real-world usefulness: 4.** The officially recommended way to run agents in parallel is git worktrees, which already isolate edits. This only helps people who run several agents in one working tree, a habit the docs steer users away from.

## WIN CHANCE (Agent Memory and Coordination): ~5%
The idea fits the track squarely (shared state, handoffs between agents, persistent history), and judges who are developers will relate to the problem. Against that: the track will be crowded with "memory for agents" entries, the field has perhaps 100–300 real submissions, and a reviewer who knows that worktrees exist will discount the premise. With a polished demo, the realistic outcome is top 50, not first place.

## EVIDENCE
- **Hooks support the core mechanism.** A `PreToolUse` hook on `Edit|Write` can return `permissionDecision: "deny"` with a reason that Claude reads. `SessionStart` can inject `additionalContext`, and every hook receives `session_id` (plus `agent_id` inside subagents). One catch matters: **a hook that times out or crashes does not block the edit** unless `onFailure: "block"` is set. So if FalkorDB goes down, the controller fails open without any sign. [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)
- **Prior art covers the blocking feature.** agent-coord already uses a PreToolUse hook to block edits to locked files. CodeFleet, interlock, claude-net and mcp-lock-manager all lock files for parallel Claude agents. None of them, as far as I can see, reasons over dependencies. [search results: code-fleet, interlock, claude-net, mcp-lock-manager](https://download.plaud.ai/ashnkumar/code-fleet), [interlock](https://agentskill.sh/plugins/mistakeknot/interlock), [mcp-lock-manager](https://www.remoteopenclaw.com/mcp/maxwellplanck/mcp-lock-manager), [agent-locks](https://images.glama.ai/mcp/servers/luohoa97/agent-locks)
- **Worktrees are the official answer to the same problem.** [code.claude.com/docs/en/worktrees](https://code.claude.com/docs/en/worktrees); worktrees prevent live collisions but not later merge conflicts ([morphllm](https://www.morphllm.com/claude-code-git-worktree)). The honest pitch is therefore *semantic* conflicts across worktrees, which the brief puts out of scope.
- **FalkorDB WCC filters only by label and relationship type.** `CALL algo.wcc({nodeLabels, relationshipTypes})` takes those two filters and no arbitrary node set. To run WCC on just the planned tasks' files, the builder has to copy that subgraph into a scratch graph first. [docs.falkordb.com/algorithms/wcc](https://docs.falkordb.com/algorithms/wcc)
- **FalkorDB already ships a code graph.** Its own Code-Graph project, and a community FalkorDB + tree-sitter + MCP indexer, already model code as a graph, so "code as a graph" earns no originality points. [falkordb.com/blog/code-graph-is-the-secret](https://www.falkordb.com/blog/code-graph-is-the-secret/), [codebase-graph](https://gh.mise.run.place/Phoenixrr2113/codebase-graph)
- **No past WeMakeDevs winning projects could be found.** I found only prize announcements, so there is no pattern to calibrate against. [t.me/s/WeMakeDevs](https://t.me/s/WeMakeDevs)

## SIMULATION (summary)
- **Day 1:** FalkorDB in Docker, the schema, and a TypeScript parser. Tree-sitter gives syntax but cannot resolve which `User` a file references, so day 1 ends with a switch to ts-morph.
- **Day 2:** the hooks, claim upsert and expiry, and the 3-hop path query.
- **Day 3:** WCC with a scratch graph, the briefing, the "why" trace, and the canvas built on SSE plus Cytoscape.
- **Day 4:** recording the demo, the Cloudflare tunnel, the README. Recording three live agents takes 10+ takes.

**Where the demo breaks:** in shot 2, Agent B may never touch the targeted file. In shot 3, "Agent A records a decision" needs an MCP tool or CLI that does not exist yet. In shot 1, a dense TypeScript repository makes everything reachable within 3 hops, so the planner reports one component and nothing runs in parallel.

**Five judge questions:**
1. "Why not worktrees?"
2. "What happens if A and B each block the other?"
3. "If FalkorDB goes down, do edits pass through?" (They do: the hook fails open.)
4. "How do you avoid false positives at 3 hops?"
5. "Isn't this agent-coord with extra steps?"

## STEELMAN / ATTACK
- **For:** deterministic, cheap to run (well under $30), honest graph work, and dogfooding produces a real dataset. Only the graph can produce the explainable denial path.
- **Against:** the premise competes with worktrees, the 3-hop rule is either too blunt (blocks everything) or too weak (misses semantic conflicts), and half the feature list is filler for the demo.

## TOP 3 FLAWS
1. **Over-blocking.** In a real TypeScript repository, `types/` is imported almost everywhere. Once one agent claims `models/user.ts`, every other agent is denied for 15 minutes and parallelism collapses to one agent working.
2. **Fail-open hook and deadlock.** If the tunnel or Docker hiccups mid-demo, the edit goes through without any sign. If A waits on B while B waits on A, both agents spin, and nothing in the design detects the cycle (although a cycle check is itself an easy graph query).
3. **Scope.** Five features plus a live canvas, for one builder in 4 days. The "why" trace and briefings depend on agents recording decisions reliably, and that is unproven.

## THE BEST VERSION
- **Cut:** live three-agent orchestration in the video (script one agent and replay the others' events), and the 15-minute timer (use task-scoped claims).
- **Keep:** the deny-with-path hook, `SessionStart` briefings, the canvas showing the Cypher that ran.
- **Add:** worktree support, so the graph warns across branches where git cannot. Make claims symbol-level (REFERENCES a *changed* symbol), not file-level reachability. Add a deadlock-cycle query. Set `onFailure: "block"`. Add a `record_decision` MCP tool. Build it on ts-morph rather than raw tree-sitter.

## VERDICT
Build it with changes: the dependency-path denial is a real, demoable use of the graph, but cut the scope to hook, briefing and canvas, and reframe it around cross-worktree symbol conflicts so it does not lose to "just use worktrees."
