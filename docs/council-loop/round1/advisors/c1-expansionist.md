# Candidate 1: Expansionist review (dependency-aware traffic controller for parallel Claude Code agents)

**SCORES (1–10)**
- **Graph essential: 8.** Without the graph there's no 3-hop IMPORTS/REFERENCES reachability, no WCC task grouping and no decision trace. Take FalkorDB out and you're left with a plain file lock, which already exists elsewhere.
- **Demo memorability: 7.** Watching an agent get refused with the exact dependency path drawn on screen is easy to understand. "Built with itself, here's the 4-day log" is a strong closing line.
- **4-day feasibility: 5.** Hooks are easy (documented deny + reason). Tree-sitter parsing for one language is fine. But there are four features, a live canvas, incremental re-parsing and a scripted demo with three real agents, which can behave differently on every run. That's a lot for one person.
- **Originality: 6.** File leases are common (Agent Mail, interlock, CodeFleet, mcp-lock-manager). Transitive-overlap checks exist as skill files, and codegraph hooks only warn. Doing enforced blocking off a graph, with explained paths, decisions and WCC planning, is a fresher combination.
- **Usefulness: 6.** The pain is real for people who run several agents on one repo (the builder is one), but that group is small. As written, 3 hops will block too often.

**WIN CHANCE (Agent Memory and Coordination): ~10%.** Judges from FalkorDB and WeMakeDevs are developers, and many run parallel agents themselves. "Shared state and handoffs between agents" fits the track brief almost word for word. Most of the 100–300 entries will be chat-over-docs memory bots, so this stands out. It also has a second entry in track 1 and a natural blog-prize story. It loses ground if the demo looks staged or the canvas is rough.

**EVIDENCE**
- Hooks: PreToolUse can return `permissionDecision: "deny"` with a reason that Claude sees. SessionStart `additionalContext` injects text, and text over 10k characters gets truncated to a preview. **A PreToolUse hook that times out fails open** unless `onFailure: "block"` is set. https://code.claude.com/docs/en/hooks
- FalkorDB `algo.WCC` exists. It takes `nodeLabels` and `relationshipTypes`, returns `node, componentId` and runs in O(V+E). https://docs.falkordb.com/algorithms/wcc
- Prior art, file leases:
  - MCP Agent Mail: advisory leases, about 1.9k stars. https://www.sourcepulse.org/projects/17919792
  - interlock. https://www.claudepluginhub.com/plugins/mistakeknot-interlock
  - mcp-lock-manager and CodeFleet. https://glama.ai/mcp/servers/maxwellplanck/mcp-lock-manager
  - Rhizome: expiring task leases. https://mcpservers.org/servers/odrin/rhizome-mcp
- Prior art, dependency-aware tools:
  - A harness skill groups tasks into parallel-safe sets using transitive overlap. https://openskillindex.com/skills/intense-visions-harness-engineering-harness-parallel-agents-bc7c15
  - codegraph hooks are warn-only and fail open. https://glama.ai/mcp/servers/w5qvkhne6a
  - FalkorDB's own code-graph demo and codebase-graph both use tree-sitter with FalkorDB for exploration, not coordination. https://www.sourcepulse.org/projects/1890331 · https://glama.ai/mcp/servers/Phoenixrr2113/codebase-graph
- Tree-sitter only sees syntax, not data flow. https://arxiv.org/pdf/2605.17279
- I found no published winners list from WeMakeDevs graph hackathons. The sponsor's rules stress that "the graph does real work". https://www.wemakedevs.org/hackathons/falkordb/rules

**Simulation (short).**
- **Build:**
  - Day 1: graph schema, tree-sitter ingest, the claim/deny hook working.
  - Day 2: WCC planner and SessionStart briefing.
  - Day 3: canvas and Decision/why trace.
  - Day 4: seeding the demo repo, recording, README.
  - Where it breaks: day 3 runs out of time, and re-parsing on every edit adds hook latency.
- **Demo:**
  - Shot 2, the block, is the money shot.
  - Shot 3, kill and resume, is slow on video.
  - Shot 1 fails if the shared `types/` file joins all three tasks into one component.
- **Judge questions:**
  1. "Isn't this a lockfile?"
  2. "What happens when it blocks a harmless edit?"
  3. "Can't the agent just use Bash `sed` to get around it?"
  4. "Where's the memory?"
  5. "Does it fail closed?"
  Questions 2 and 3 are dangerous today.

**Steelman:** it's the most "graph does real work" idea possible. Path queries, WCC and decision lineage each answer a question that SQL handles badly, and the builder is their own real user.
**Attack:** a niche audience, crowded neighbours, and blocking that will feel too aggressive to anyone who tries it.

**TOP 3 FLAWS**
1. **Over-blocking.** In a TypeScript repo, `types/User.ts` is referenced by nearly every file. With 3 undirected hops, one claim on it blocks the whole repo, and WCC returns a single giant component. The demo only works because the repo is pre-seeded, and a judge who tries it on a real repo sees everything denied.
2. **Easy to get around and fails open.** The hook covers only Edit/Write. An agent that's been denied tends to retry through `Bash` (`cat > file`), and a slow graph query times out and allows the edit anyway. Judge question 3 then sinks the "traffic controller" claim.
3. **Too much scope for a nondeterministic demo.** Four features plus a canvas, and three real agents that won't follow the script. The likely result is one polished feature, three half-built ones, and a video made of cuts.

**THE BEST VERSION**
- **Cut:**
  - Make the "why" trace a single query, not a feature.
  - Make the briefing a template, with Claude summarising only if there's time.
- **Keep:** the deny-with-path hook, WCC planning and the canvas.
- **Fix:**
  - Make blocking *directional*. Deny only when the edit touches something a claimed file depends on, or vice versa, and at most 2 hops away.
  - Leave out high-degree hub nodes, found with degree or PageRank, or downgrade them to "warn".
  - Add a matcher on `Bash` writes.
  - Set `onFailure: "block"`.
- **Add (the standout upside):**
  - Turn the dogfood log into **evidence**: "over 4 days and N agent-hours, the graph prevented K conflicting edits, and here are 3 real ones." That headline number and the dataset are what no other entry will have.
  - Add a scrubbable timeline replay of the real 4-day graph on the canvas.
  - Expose claims and the planner as a tiny MCP tool so agents can *ask* before editing, which fits track 1's "tool selection via MCP".
  - Write the blog post from the log, for the AirPods side prize.

**VERDICT: build it with changes.** The core loop of graph-explained blocking plus real dogfood numbers can stand out, but only if blocking becomes directional, hub-aware and fails closed, and the side features are cut to fit 4 days.
