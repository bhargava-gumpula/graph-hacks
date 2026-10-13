# Executor review: Candidate 1, the pre-install publisher-exposure guard

I read the brief twice. Its promises: crawl the dependency closure of 2,000 seed packages (8–15k packages) on day 1; on-demand fetch for missing packages; three tools (`exposure`, `compare_install`, worm replay); a Claude Code `PreToolUse` hook on `npm install`; PageRank labels; a canvas; validation against `npm ls --all` on 10 projects; a live deployment through a Cloudflare Tunnel; a 2-minute demo.

## SCORES (1–10)
- **Graph essential: 7.** Turning reachability into publishing accounts and taking a set difference across two traversals is native graph work. Without FalkorDB you would rebuild the same thing as recursive SQL. It falls short of 8 because most of the work is plain BFS, and PageRank is decoration.
- **Demo memorability: 6.** "Your agent just chose its dependency by counting who can publish" is a sharp hook on top of real 2025 incidents. The scripted example has a factual flaw, though (see flaw 1).
- **4-day feasibility: 7.** The scope is small and well bounded: three features, one ecosystem, the latest version only. The crawl and the hook are each a day of work at most. The risks are query blow-up and how the demo is choreographed, not volume.
- **Originality: 6.** Socket already ships an MCP server and a Claude Code hook that block risky installs. The publisher-count *delta* between candidates is new; the problem framing is not.
- **Real-world usefulness: 5.** Lockfiles, 2FA/trusted publishing and Socket-style scanners all reduce the risk being measured. "Count every maintainer" overstates the exposure, and a real team would want the publish controls the tool deliberately leaves out.

## WIN CHANCE (Agents That Act on Connected Data): ~8%
It hits the track's keywords squarely: an MCP tool, multi-hop queries, a graph-driven action and explainable paths. Execution is very likely to be clean. But this track draws the most entries and has a single prize, and security-triage agents are an explicitly listed example, so similar ideas will appear. It is top-10 material; the winner needs a more visceral demo.

## EVIDENCE
- Socket MCP (`depscore`, hosted endpoint, optional Claude Code hook that denies installs when the supply-chain score is below 20) is the closest prior art: https://docs.socket.dev/docs/guide-to-socket-mcp, https://mcpservers.org/servers/SocketDev/socket-mcp
- Zimmermann et al. found that an average package implicitly trusts 39 maintainers and that a few accounts reach most of npm: https://www.usenix.org/conference/usenixsecurity19/presentation/zimmerman, https://arxiv.org/pdf/1902.09217
- Shai-Hulud: about 500 packages in September 2025, then 600–800 in November 2025 (wave 2), spread by stolen maintainer tokens: https://www.picussecurity.com/resource/blog/shai-hulud-worm-inside-the-npm-supply-chain-attack, https://www.invicti.com/blog/web-security/shai-hulud-2-worm-supply-chain-attack-on-npm-dependencies
- GitHub's npm hardening (required 2FA, short-lived tokens, trusted publishing) weakens the "every maintainer can publish" assumption: https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/, https://nesbitt.io/2026/08/18/two-factor-authentication-across-package-registries.html
- FalkorDB has `CALL algo.pageRank(label, relType) YIELD node, score`: https://docs.falkordb.com/algorithms/pagerank. I could not reach docs.falkordb.com directly (DNS failure from my environment), so cost limits on variable-length matching are unconfirmed.
- npm publishes no fixed rate-limit numbers; clients are expected to handle 429 responses and back off: https://blog.npmjs.org/post/164799520460/api-rate-limiting-rolling-out, https://apis.io/rate-limits/npm/npm-rate-limits/
- I found no published winners of the previous WeMakeDevs × FalkorDB event: https://www.wemakedevs.org/hackathons/falkordb

## Simulation
**Build.**
- Day 1, hours 0–4: the crawler. The abbreviated packument has no maintainer list, so fetch `/<pkg>/latest`, which is small and includes both `maintainers` and `dependencies`. This works.
- Day 1, hours 4–10: load the graph with UNWIND batches.
- Day 2: features 1–2. A first-draft `MATCH p=(:Project)-[:USES|DEPENDS_ON*]->()<-[:CAN_PUBLISH]-(a)` enumerates *paths*, and in a dense DAG like npm that explodes. You need distinct reachability first, then a shortest path per account only for the delta. This is the first real stall, costing about half a day.
- Day 2, evening: the hook works: match `npm install` in the Bash command and return `additionalContext`.
- Day 3: the canvas plus the replay. The replay is a bounded BFS done in rounds.
- Day 4: `npm ls` validation. Expect a match rate of 80–90%, because using the latest version ignores semver ranges and the brief doesn't say how peer and optional dependencies are handled. That is not a disaster, but the number will draw questions.

**Demo.**
- Shot 2 breaks: `dayjs`, `date-fns` and `moment` each have **zero runtime dependencies**, so each adds only its own maintainers. "1 vs 40 publishers via 3 paths" will not happen with date libraries.
- Shot 3 (the worm "never" reaches the project with A) depends on that same contrast.

**A skeptical judge's 5 questions.**
1. Isn't your lockfile already protecting me?
2. How does this differ from Socket's MCP?
3. Most top packages have trusted publishing now. Aren't these counts inflated?
4. Why is the match rate below 100%?
5. Does the agent really choose, or did you prompt it to?

Questions 2 and 3 are the dangerous ones.

## Steelman / Attack
**For:** a tight scope, a timely hook, a correct and honest framing, a graph that does the reasoning, and Cypher that is shown on screen. It is very shippable by one builder.

**Against:** a known research result wrapped in a tool, a direct incumbent, a threat model that is going stale as npm hardens publishing, and a demo whose drama depends on hand-picked numbers.

## TOP 3 FLAWS
1. **The demo example is wrong.** Date libraries have no dependencies, so the comparison comes out 1 vs 2 publishers and the shot falls flat on camera. Fix it with a pair that really diverges, such as `request` vs `ky`, `express` vs `hono`, or `jest` vs `vitest`, and measure the pair on day 1.
2. **Path-enumeration blow-up.** A naive variable-length match from Project to Account times out on a big project like `jest` with about 300 dependencies, and the hook then hangs Claude Code mid-demo. Precompute closures and give the hook a timeout with a fallback.
3. **The "every maintainer can publish" assumption.** A FalkorDB or security judge asks about trusted publishing and 2FA. The answer "we don't model it" makes the headline number look inflated, and the usefulness argument collapses.

## THE BEST VERSION
- **Cut:** PageRank.
- **Keep:** `compare_install`, the hook, Cypher shown on screen, and the worm replay as the visual.
- **Add:**
  - Choose a demo pair whose numbers have actually been measured.
  - A per-package "publishing signals" flag where public data exists (provenance attestations are visible in packument `dist.attestations`), so accounts behind trusted publishing are weighted down.
  - A one-line Socket comparison in the README: "Socket scores a package; we score the *delta in who can ship to you*."

## VERDICT
Build it with changes: it is very shippable, but swap the demo pair on day 1, design the queries around reachability rather than path enumeration, and add provenance signals so the core number survives a security judge.
