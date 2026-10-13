# Candidate 1, Expansionist review: pre-install publisher-exposure guard (MCP + FalkorDB)

## SCORES (1–10)
- **Graph essential: 8.** "Accounts reachable from a project through DEPENDS_ON*/CAN_PUBLISH, minus the accounts it already reaches" is a multi-hop, set-based question. Without the graph the product does nothing. FalkorDB ships `algo.pageRank` and `algo.BFS` natively ([procedures](https://docs.falkordb.com/cypher/procedures), [algorithms](https://docs.falkordb.com/algorithms)).
- **Demo memorability: 7.** Claude Code pausing before `npm install` and choosing the package that adds fewer publishers is a clean agent moment. A worm spreading round by round is visual and topical. It falls short of 8 because the brief's own example (moment, dayjs, date-fns) probably gives no contrast: all three have roughly zero runtime dependencies.
- **4-day feasibility: 6.** A crawl of about 10k packuments, three Cypher features, a hook and a canvas is tight for one person but scoped. It falls short of 7 because the canvas plus the worm replay plus validation against `npm ls` on day 4 will squeeze the video.
- **Originality: 6.** The finding comes from 2019 research ([Zimmermann et al.](https://www.usenix.org/conference/usenixsecurity19/presentation/zimmerman)). Maintainer counting exists as `depmain` ([repo](https://github.com/nullvoxpopuli/dependency-maintainers)). Socket already has an MCP server for agents ([socket-mcp](https://glama.ai/mcp/servers/@SocketDev/socket-mcp/tree/754558339e8f3f2d22bc86e86f68ceddf5dfb380)). What is new is a publisher-delta comparison inside the agent's decision loop.
- **Real-world usefulness: 6.** The risk is real and recent: Shai-Hulud hit 500+ packages in September 2025 and 600–800 in November 2025 ([Picus](https://www.picussecurity.com/resource/blog/shai-hulud-worm-inside-the-npm-supply-chain-attack), [Invicti](https://www.invicti.com/blog/web-security/shai-hulud-2-worm-supply-chain-attack-on-npm-dependencies)). But "count of maintainers" is a crude proxy, and the brief admits it cannot see 2FA or trusted publishing.

## WIN CHANCE (Agents That Act on Connected Data): ~8%
Out of perhaps 150–250 real submissions, this is in the top band for track fit. It has MCP tool selection, multi-hop queries, explainable paths, an action the graph drives, and security triage, which is one of the track's own examples. Most entries will be generic GraphRAG chatbots. This one has a crisp question, real public data and a news hook. What holds it back: there is one prize, judges may prefer flashier agentic demos, and the hit-rate is capped by how dramatic the real numbers turn out to be.

## EVIDENCE
- Socket MCP gives package security scores (`depscore`) to Claude, Cursor and others. It does not do a publisher graph, a per-candidate publisher delta or a worm reachability model ([socket-mcp](https://glama.ai/mcp/servers/@SocketDev/socket-mcp/tree/754558339e8f3f2d22bc86e86f68ceddf5dfb380)).
- `depmain` lists the maintainers across `node_modules` with counts. It has no candidate comparison, no paths and no agent integration ([repo](https://github.com/nullvoxpopuli/dependency-maintainers)).
- The 2019 paper's slides: the average package implicitly trusts 79 packages and 39 maintainers ([USENIX PDF](https://usenix.org/system/files/sec19-zimmermann.pdf)).
- GitHub's response to Shai-Hulud: short-lived tokens, publishing tokens disallowed by default, and a push towards trusted publishing with provenance ([GitHub blog](https://github.blog/news-insights/company-news/our-plan-for-a-more-secure-npm-supply-chain/)). Provenance attestations are public, which contradicts the brief's "no barrier visible" premise. That is an upside: some barriers *can* be modelled.
- npm publishes no numeric limits for public reads. Plan for 429s with backoff ([apis.io](https://apis.io/rate-limits/npm/npm-rate-limits/), [npm blog](https://blog.npmjs.org/post/164799520460/api-rate-limiting-rolling-out)).
- The FalkorDB docs disagree about BFS naming (`algo.BFS` vs `algo.bfs`). Test it on day 1 ([BFS page](https://docs.falkordb.com/algorithms/bfs.html)).
- Third-party guides disagree on whether `additionalContext` is allowed in PreToolUse output ([nagdy](https://claude.nagdy.me/learn/hooks/), [vincentqiao](https://blog.vincentqiao.com/en/posts/claude-code-settings-hooks/)). The fallback is exit code 2 with feedback on stderr.
- Past WeMakeDevs winners were not findable in detail ([WeMakeDevs llms.txt](https://www.wemakedevs.org/llms.txt)). Their events reward working, demoable integrations with partner tech.

## Simulation (short)
**Build.** Day 1: crawl about 10k packuments in 3–5 hours with backoff, then load with UNWIND batches. Day 2: Cypher for exposure and delta, the MCP server and the hook (the hook output format is a risk). Day 3: the canvas and the worm (the worm is a multi-hop expansion where each round alternates packages and accounts, so the frontier blows up after round 2 and has to be capped). Day 4: validation, the tunnel and the video.

**Demo.** Shot 2 breaks if the candidates are all zero-dependency packages.

**Judge questions.**
1. "Lockfiles pin this. So what?" Answered up front.
2. "Maintainer count is not risk." Partly answered.
3. "Why not Socket?" Answer: delta plus paths.
4. "Why a graph DB rather than `npm ls`?" Answer: cross-project account reach and the worm model.
5. "Did you validate?" Answer: the README match rate.

## Steelman / attack
**For.** The question is sharp, the timing is right, the graph does the work and the agent visibly changes behaviour. It is an honest brief with its limits stated.

**Against.** The metric is crude and well known. The demo's key contrast is unverified. The worm replay is a worst-case toy that a security judge may dismiss.

## TOP 3 FLAWS
1. **No contrast in the demo.** moment, dayjs and date-fns each add about one publisher, so "1 vs 40" never shows up and the hero moment falls flat. Fix: on day 1, mine the graph for real high-contrast pairs (`axios` vs `ky`, `request` vs `node-fetch`, `jest` vs `vitest`).
2. **Uniform account weight.** A judge points out that half of those "40 publishers" publish only with provenance, so the number overstates the risk. Without a barrier signal, the score looks naive.
3. **Cost of the worm and traversal.** A variable-length path enumeration (`[:DEPENDS_ON*]`) on hub packages times out live. Use BFS reachability and `shortestPath` for each account, and precompute.

## THE BEST VERSION
Keep the delta tool, the hook and the paths. **Add** a provenance/trusted-publisher flag from public attestations, so accounts get a "weak link" weight and the tool can say: "B adds 40 accounts, 31 without provenance; via path X." **Add** a `suggest_alternative` query: packages with the same keywords and the fewest new weak publishers, so the agent acts rather than only compares. **Shrink** the worm replay to a precomputed animation of one real Shai-Hulud seed, such as `@ctrl/tinycolor`. **Cut** the custom canvas polish in favour of FalkorDB Browser screenshots if day 3 slips. Write the blog post for the AirPods side prize.

## VERDICT
Build it with changes: find real high-contrast package pairs on day 1 and add a provenance signal, which turns a known statistic into a sharp, defensible agent tool.
