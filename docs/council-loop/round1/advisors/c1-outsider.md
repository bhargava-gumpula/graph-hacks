# Outsider advisor: Candidate 1, dependency-aware traffic controller for parallel Claude Code agents

**My reading as a first-time judge:** the one-line pitch works: "air-traffic control for AI coding agents: it won't let agent B edit a file that depends on something agent A is changing, and it shows you why." I understood it in about ten seconds. The brief, though, lists five features plus a canvas plus a published dataset, and that blurs the pitch.

## SCORES (1–10)
- **Graph essential: 7.** The denial depends on a 3-hop IMPORTS/REFERENCES traversal and the planner uses `algo.wcc`. Plain file locks can't do either, so taking FalkorDB out would break the core feature. ([WCC docs](https://docs.falkordb.com/algorithms/wcc))
- **Demo memorability: 6.** "Edit denied, here's the path" is a real moment that's easy to grasp. The WCC task split and the "why" trace are harder for non-specialists to follow, and the shot list has four beats in two minutes.
- **4-day feasibility for one builder: 5.** The hook mechanics are documented and simple ([hooks reference](https://code.claude.com/docs/en/hooks)). On top of that come tree-sitter refresh on every edit, claims with TTL, decisions, events, briefings, a live canvas and orchestrating a scripted three-agent demo, all from one person.
- **Originality vs competitors: 5.** File locks for parallel Claude agents already exist several times over. Dependency-path blocking that's stored in a graph and explains itself is the only new part.
- **Real-world usefulness: 5.** The pain is real, but most people running parallel agents isolate them with git worktrees. That leaves a niche: people who run several agents in one working tree on a TypeScript repo.

## WIN CHANCE (Agent Memory and Coordination): ~6%
Of perhaps 100–300 real submissions, a track probably has 40–100. This entry fits "shared state and handoffs between agents" well, and FalkorDB judges will like a graph that does real work. Against it: judges who live outside the Claude Code world may see it as a developer tool for a small audience, and memory-themed entries (chat memory, per-user graphs) are easier to explain to everyone. It's well above the ~1–2% base rate, but it's not a favourite.

## EVIDENCE
- Crowded prior art. [CodeFleet](https://download.plaud.ai/ashnkumar/code-fleet) refuses a second agent's edit to a locked file. [agent-locks](https://images.glama.ai/mcp/servers/luohoa97/agent-locks) is an MCP lock server that works across worktrees. [claude-net](https://skillselion.com/skills/andrehrferreira/claude-net/.claude-plugin) offers file locks, a build mutex and messaging. [mcp-lock-manager](https://www.remoteopenclaw.com/mcp/maxwellplanck/mcp-lock-manager) provides file-level locks across Claude Code instances.
- Closest to the dependency angle: [Clash](https://www.producthunt.com/p/clash-5) checks for merge conflicts across worktrees before an edit and integrates with Claude Code. [Foremerge](https://www.promptzone.com/rowan_petrov/foremerge-spots-intent-conflicts-in-parallel-ai-agents-3lem) builds a dependency graph of the symbols agents modify. A [semantic-conflict-prediction skill](https://claudskills.com/skills/semantic-conflict-prediction/SKILL.md) uses tree-sitter symbol graphs to predict conflicts when work is assigned.
- The sponsor's own [FalkorDB/code-graph](https://github.com/FalkorDB/code-graph) already turns code into a FalkorDB graph (Python, Java and C#, no TypeScript). Judges have seen "code as a graph" before.
- Hooks: a PreToolUse `deny` passes `permissionDecisionReason` to Claude, and SessionStart `additionalContext` injects the briefing. Pitfall: a PreToolUse hook that times out **does not block** unless `onFailure: "block"` is set. Hooks also run inside subagents and carry `agent_id` ([hooks docs](https://code.claude.com/docs/en/hooks)).
- Agent teams are experimental, and worktrees are the stable route to isolation ([Morph](https://www.morphllm.com/claude-code-git-worktree), [MindStudio](https://www.mindstudio.ai/blog/claude-code-agent-teams-shared-task-list)). That shrinks the audience.
- I found no list of past WeMakeDevs project winners ([archive](https://archive.wemakedevs.org/)). Their partner testimonial praises "orchestrating MCP agents", a small hint that this topic suits the audience.

## Simulation (short)
- **Days 1–2:** hooks, claims and the 3-hop query work by the end of day 1. Incremental tree-sitter parsing of TypeScript and resolving REFERENCES eat day 2.
- **Day 3:** briefing, decisions and the canvas.
- **Day 4:** scripting three live agents so they collide on cue is fragile, and I expect many retakes of the video.
- **Skeptical judge:** "Why not just use worktrees?" "Doesn't 3 hops block everything?" "How is this different from CodeFleet or Clash?" "What happens if FalkorDB is down?" "Who has actually used it?" The 3-hop question and the worktrees question are where the pitch wobbles.

**Steelman:** the problem is real and current, the graph is necessary, the output explains itself, the build is self-hosted and nearly free to run, and the project dogfoods itself.
**Attack:** it's a niche developer tool in a space already full of lock tools, and its headline feature may block so much that it's useless in practice.

## TOP 3 FLAWS
1. **Over-blocking.** In a TypeScript app, `types/User.ts` sits within 3 hops of most files. Once agent A claims it, B and C are denied almost everywhere, and the "parallel" system runs one agent at a time.
2. **Scope spread.** Five features means each one gets shallow. On day 4 the canvas or the briefing is half-done, and the video shows rough edges.
3. **"Just use worktrees."** A judge who runs parallel agents asks why they'd share one tree at all. Without a crisp answer (worktrees still collide at merge time; this catches the break *before* the edit), the usefulness score drops.

## THE BEST VERSION
- **Keep** the deny-with-path hook and the WCC parallel-safe planner. **Add** a Clash-style mode that works across worktrees, so the tool fits how people actually work.
- **Make blocking smarter:** block only on the claimed **symbol** (REFERENCES to a symbol that's being edited), not on 3 file hops. Show the "ok vs blocked" ratio.
- **Cut** the "why" trace and the published dataset. Fold decisions into the briefing.
- Lead the demo with the denial, the path drawn, and the agent rerouting to another task.

## VERDICT
**Build it with changes:** the pitch is clear and the graph earns its place, but narrow the blocking to symbols, cut features, and answer "why not worktrees" up front.
