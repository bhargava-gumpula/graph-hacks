# Contrarian review: Candidate 1, a dependency-aware traffic controller for parallel Claude Code agents

## SCORES (1–10)
- **Graph essential: 6.** The 3-hop IMPORTS/REFERENCES reachability check and WCC really are graph work. But a "files within 3 hops of a claimed file" lookup fits in a SQLite recursive CTE, and claims, events and decisions are rows in a table, so a judge can reasonably ask what FalkorDB adds.
- **Demo memorability: 6.** A denied edit that shows its dependency path is a strong moment. Three terminals plus a canvas plus a kill-and-resume in 2 minutes is a lot to follow, and on screen it looks like "a lock said no".
- **4-day feasibility for one builder: 5.** Hooks and claims are easy. Building accurate cross-file REFERENCES edges for TypeScript with tree-sitter alone is not easy: path aliases, re-exports and barrel files all have to resolve. Add the canvas, the briefing, the why-trace and the published dataset, and the brief promises too much.
- **Originality vs competitors: 4.** Every piece already exists as open source (see Evidence). What's new is the combination, built on FalkorDB.
- **Real-world usefulness: 4.** Most people running parallel agents use git worktrees, and blocking anything within 3 hops will serialise real repositories.

## WIN CHANCE (Agent Memory and Coordination): ~5%
The idea fits this track well: shared state, handoffs, persistent history and concurrent writes. The dogfooding story is good too. Two things hold it back. First, judges who know the agent-tooling space have seen file-lock MCPs many times. Second, "memory" is thin here: the claims are really locks, and the decisions are notes the agents write themselves. With perhaps 150–300 real submissions and one prize, this lands in the top 10%, not clearly first.

## EVIDENCE
- **File locks enforced by PreToolUse hooks already exist.** agent-coord blocks edits to files another agent has locked, with TTL locks, and fails open ([glama](https://glama.ai/mcp/servers/s2hzbdblkq)). Others: claude-net, which adds conflict detection ([skillselion](https://skillselion.com/skills/andrehrferreira/claude-net/.claude-plugin)); interlock ([claudepluginhub](https://www.claudepluginhub.com/plugins/mistakeknot-interlock)); CodeFleet; and MCP Agent Mail, which has file-reservation leases and a pre-commit guard and supports Claude Code, Codex and Gemini ([GitHub](https://github.com/Dicklesworthstone/mcp_agent_mail)).
- **Parallel-safe task grouping by transitive dependency overlap already exists** as the harness-parallel-agents skill ([openskillindex](https://openskillindex.com/skills/intense-visions-harness-engineering-harness-parallel-agents-bc7c15)).
- **Tree-sitter dependency graphs injected through Claude Code hooks already exist** in GitNexus and codegraph ([themenonlab](https://themenonlab.blog/blog/gitnexus-pre-computed-dependency-intelligence-ai-agents), [glama](https://glama.ai/mcp/servers/w5qvkhne6a)).
- **Hooks behave as the brief assumes, with caveats.** Claude Code hooks support `permissionDecision: "deny"` with a reason, and SessionStart `additionalContext` (capped at about 10k characters). A PreToolUse hook that times out does **not** block unless it is configured with `onFailure: "block"`, and Bash writes such as `sed -i` show the hook only the command string ([Claude Code docs](https://code.claude.com/docs/en/hooks)).
- **FalkorDB supports the algorithm the brief needs.** `algo.wcc` takes `nodeLabels`/`relationshipTypes` filters and streams `componentId` per node ([FalkorDB docs](https://docs.falkordb.com/algorithms/wcc)).
- **Worktrees are the mainstream answer.** Third-party guides present worktrees as the standard way to stop same-file overwrites, and Claude Code agent teams are still experimental ([morphllm](https://www.morphllm.com/claude-code-worktrees), [mindstudio](https://www.mindstudio.ai/blog/claude-code-agent-teams-shared-task-list)).
- **No WeMakeDevs winner write-ups could be found** to calibrate against ([wemakedevs](https://wemakedevs.org)).

## SIMULATION
- **Day 1:** the graph schema and the tree-sitter IMPORTS parser work. REFERENCES edges are where it breaks: they need TypeScript symbol resolution.
- **Day 2:** hooks and claims work. The first real dogfooding run deadlocks, because every file reaches `types/` within 3 hops.
- **Day 3:** the canvas and the briefing.
- **Day 4:** the why-trace, deployment, the video and the README. The dataset gets cut.
- **Demo:** the scripted repository is pre-seeded so that the components split cleanly. That is honest but artificial.
- **A skeptical judge's 5 questions:**
  1. "How is this different from agent-coord or Agent Mail?"
  2. "Why not use worktrees?"
  3. "What happens with `sed -i` or `cat >`?"
  4. "On a real repo, doesn't 3 hops block everything?"
  5. "Remove FalkorDB and use SQLite. What breaks?"

  Questions 1, 2 and 4 have weak answers.

## STEELMAN vs ATTACK
**For:** the graph-path explanation for a denial is something no lock tool provides. The idea fits the track squarely. It needs almost no API spend. The product is built using itself, so the demo data is real. Developers judging it feel the pain it addresses.

**Against:** it is a crowded niche that has been reduced to a lock with a graph-flavoured error message. The heuristic itself (import reachability treated as conflict) is wrong both ways: it misses semantic conflicts and blocks safe edits. The intended users mostly avoid the problem with worktrees.

## TOP 3 FLAWS
1. **The hub-file collapse.** In any real TypeScript repo, shared `types/`, `utils/` and `index.ts` barrels put most files within 3 hops of each other. Agent A claims `types/user.ts`, and B and C are denied almost everything. WCC returns one giant component, so "parallel-safe tasks" reports zero parallelism.
2. **It fails open.** An agent that is denied an Edit often switches to Bash (`cat > file`), and the hook can't map that to files. If FalkorDB or the tunnel goes down, the hook times out and allows the edit. The safety promise can't be enforced.
3. **Prior art saturation.** A judge searches "claude code file lock hook" and finds five MIT projects. Originality then rests entirely on the path explanation and the canvas.

## THE BEST VERSION
- **Cut** the 3-hop hard deny. Default to direct claim = deny, dependency path = *warn plus a briefing injection*. Also cut the published dataset and the general why-trace.
- **Keep** the claims, the WCC task planner, the path-explaining denials and kill-and-resume.
- **Add** a Bash matcher that denies writes to claimed paths, `onFailure: "block"`, and claims scoped by symbol (Symbol-level REFERENCES) to tame the hub-file problem.
- **Show** one shot of the same flow on a real open-source TypeScript repo, not only the seeded one.
- **Answer "why not worktrees" in the README:** this predicts merge conflicts before they happen.

## VERDICT
Build it with changes: make dependency paths warnings rather than hard blocks, close the Bash and fail-open holes, and lead with the path explanation, because a plain file lock is not original.
