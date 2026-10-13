# First Principles advisor: Candidate 1 (dependency-aware traffic controller for parallel Claude Code agents)

**The underlying problem.** Several agents editing one codebase at once produce two kinds of breakage: (a) *textual* collisions, where two agents write the same file, and (b) *semantic* breakage, where agent A changes `User` and agent B's caller stops compiling. The usual fixes already exist. Worktrees handle (a), since every agent gets its own checkout and git merges at the end. Plain file locks also handle (a). For (b), `tsc`/tests catch it at merge. The brief's answer is a *pessimistic lock on a dependency proxy*: deny any edit within 3 hops of a claimed file. From first principles, that is the weak point. Being near a claimed file in the import graph does not mean you conflict with it. In a typical TypeScript repo, `types/User.ts` is imported nearly everywhere, so a 3-hop IMPORTS/REFERENCES neighbourhood around one claim can cover most of the repo. The hook would then serialize the agents it was meant to parallelize.

## SCORES (1–10)
- **Graph essential: 6.** Multi-hop path queries, the WCC task partition and decision provenance are real graph work. But a JSON adjacency list with BFS would do the blocking, so the "remove FalkorDB" test is only half passed.
- **Demo memorability: 6.** "Edit denied, here is the exact path" is a good beat. Three terminals plus a canvas in 2 minutes is busy, and judges have seen lock demos before.
- **4-day feasibility: 5.** Hooks are easy and documented. Accurate tree-sitter REFERENCES resolution for TS (re-exports, path aliases, barrel files) on every edit, plus WCC, briefings, the "why" trace, a live canvas and a dataset, is a lot for one person.
- **Originality: 5.** File-claim hooks for Claude Code already exist (agent-coord, claude-net, CodeFleet, OrchestKit). The new part is transitive, graph-derived blocking and decision provenance.
- **Real-world usefulness: 4.** Worktrees are the official answer and agent teams already claim tasks. Over-blocking makes the tool something users would switch off.

## WIN CHANCE (Agent Memory and Coordination): ~5%
It fits the track's "shared state and handoffs" theme well, and the dogfooding story is good. But it competes with 100–300 submissions, many of them memory-layer projects, and its core blocking mechanic is already done in simpler projects.

## EVIDENCE
- PreToolUse can return `permissionDecision: "deny"` with a reason shown to Claude. SessionStart `additionalContext` is capped at 10,000 chars. Command hooks time out after 600 s by default. ([hooks docs](https://code.claude.com/docs/en/hooks))
- Prior art on lock hooks: [agent-coord](https://images.glama.ai/mcp/servers/ThatHunky/agent-coord) (glob locks, task claims, PreToolUse blocking), [agent-locks](https://images.glama.ai/mcp/servers/luohoa97/agent-locks), [CodeFleet](https://download.plaud.ai/ashnkumar/code-fleet) (a denied-write-then-retry demo), [claude-net](https://skillselion.com/skills/andrehrferreira/claude-net/.claude-plugin), [OrchestKit worktree-coordination](https://playbooks.com/skills/yonatangross/orchestkit/worktree-coordination) (locks, heartbeats, decision log).
- Official isolation is worktrees ([Claude Code worktrees](https://code.claude.com/docs/en/worktrees.md)). Agent teams use a locked shared task list ([morphllm](https://www.morphllm.com/claude-code-agent-teams)).
- `algo.wcc` exists but filters only by `nodeLabels`/`relationshipTypes`, not arbitrary per-task file sets, so the "subgraph of touched files" needs projection edges or a temporary graph ([FalkorDB WCC](https://docs.falkordb.com/algorithms/wcc)).
- FalkorDB already ships [Code-Graph](https://docs.falkordb.com/genai-tools/code-graph.md) (tree-sitter-style analyzers, a 3-hop caller query in its [blog](https://www.falkordb.com/blog/code-graph-is-the-secret/)), so parsing code into a graph is not new to these judges.
- I found no published winners for past WeMakeDevs/FalkorDB events ([search](https://www.wemakedevs.org/hackathons/falkordb/schedule)), so judging taste can't be checked.

## SIMULATION (where it breaks)
Day 1: hooks and claims work. Day 2: the TS REFERENCES resolver eats the day on aliases and barrels. Day 3: WCC projection, the briefing, the canvas. Day 4: demo recording, README, deployment. The demo is pre-seeded and scripted, so it hides over-blocking. A skeptical judge asks: *"Why not worktrees?" "How many edits did it wrongly deny on your own 4-day log?" "Why 3 hops?" "Doesn't BFS in Python do this?" "What happens when an agent never renews?"* The second question is the one the brief can't answer yet.

## TOP 3 FLAWS
1. **Over-blocking.** The 3-hop rule around a shared type denies about 80% of edits, agents spin on retries, and the dogfood log shows the tool cost more time than it saved.
2. **It solves the problem worktrees already solve.** A judge running `claude --worktree` sees no textual conflict to prevent, and semantic breakage is caught by `tsc` at merge.
3. **Parser fidelity.** Missed re-exports mean a real dependency path is absent, so the "safe" parallel set breaks in the live demo.

## THE BEST VERSION
Keep the graph, claims, decision provenance, the kill-and-resume briefing and the path explanation. Change **deny** to **warn plus impact**: allow the edit but inject "you are 1 hop from agent-2's claimed `models/user.ts`; their decision: X". Deny only direct same-file or same-symbol claims. Make it worktree-compatible, so the graph coordinates *across* worktrees, which locks can't do. Cut the 4-day dataset and the live canvas polish. Add one measured number from dogfooding: conflicts caught versus false blocks.

## VERDICT
Build it with changes: graph-based coordination of Claude Code agents is a real need, but blocking on a 3-hop import radius is the wrong fix, so pivot to symbol-level claims plus graph-derived impact warnings and decision handoff.
