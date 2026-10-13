# Outsider review: candidate 1, "pre-install guard for npm publishers"

I'm reading this as a smart judge who isn't a specialist and is seeing it for the first time. The one-line pitch works: *"Before your AI agent installs a package, it checks how many strangers could then ship code into your app."* People will remember it, because Shai-Hulud was big news. The problem is the step after the pitch. A non-specialist will ask whether "fewer publishers" really means "safer", and the brief admits the tool can't see 2FA or trusted publishing, which are the controls npm added after the worm.

## SCORES (1–10)
- **Graph essential: 7.** Following Project→Package→Account across many hops and comparing two traversals is genuinely graph-shaped. Still, `npm ls` plus a script over packuments could answer the same question for a single project, so FalkorDB isn't strictly irreplaceable.
- **Demo memorability: 6.** The "hook fires, agent picks the safer library" moment is good. But the numbers are placeholders, and the headline example probably fails: dayjs and date-fns have essentially no runtime dependencies, so "A adds 1, B adds 40" may not appear for date libraries at all.
- **4-day feasibility: 6.** Crawling 8–15k packuments from a registry with no published rate limits, loading them, and building an MCP server, a hook, a canvas and a worm replay is a lot for one person. The fallback to a 1,000-package seed list helps.
- **Originality: 5.** `contributor-count` and `dependency-maintainers` already count publishers across a dependency tree, and Socket already ships an MCP tool that agents query about packages. The new part is moving the check to install time and comparing candidates, which is a small step.
- **Real-world usefulness: 5.** Lockfiles, the missing 2FA data and npm's new token rules all weaken the metric. A careful team would use Socket or Snyk. Open-source library authors are a plausible niche audience.

## WIN CHANCE (main track): ~6%
It fits the "agents that act on connected data" track well, it's explainable, and it touches a timely security topic, so it should land in the top 10–15% of 100–300 real entries. Winning would take a demo with real, dramatic numbers, and the security nuance may not come across to WeMakeDevs judges in two minutes.

## EVIDENCE
- Socket's MCP server already gives agents dependency risk scores on demand: [socket.dev/blog/socket-mcp](https://socket.dev/blog/socket-mcp), [mcpservers.org listing](https://mcpservers.org/es/servers/SocketDev/socket-mcp). A third-party `pre_flight_check` MCP tool for AI-added dependencies exists too: [@graneth/mcp-server](https://socket.dev/npm/package/@graneth/mcp-server).
- Publisher counting is prior art: [contributor-count](https://npmjs.com/package/contributor-count), [dependency-maintainers](https://awesome.ecosyste.ms/projects/github.com%2Fnullvoxpopuli%2Fdependency-maintainers), and the research itself: [Small World with High Risks](https://blog.acolyer.org/2019/09/30/small-world-with-high-risks/).
- Shai-Hulud is real and was large: 187–500+ packages in September 2025, and 1,280+ packages across about 350 accounts in wave 2 ([InfoWorld](https://www.infoworld.com/article/4095604/new-shai-hulud-worm-spreading-through-npm-github-2.html), [Flashpoint](https://flashpoint.io/blog/shai-hulud-worm-targeting-npm-supply-chains/), [hackmag](https://hackmag.com/news/shai-hulud-2-0)). The worm republished each victim's top ~20 packages, which supports the "account → its other packages" step in the replay.
- GitHub has since mandated 2FA, retired classic tokens and pushed trusted publishing ([The Hacker News](https://thehackernews.com/2025/09/github-mandates-2fa-and-short-lived.html), [SD Times](https://sdtimes.com/security/github-details-upcoming-changes-to-improve-security-in-wake-of-shai-hulud-worm-in-npm-ecosystem/)). That weakens the "every maintainer can publish" assumption.
- FalkorDB supports `algo.pageRank(label, relType)` ([docs](https://docs.falkordb.com/algorithms/pagerank)) and has pathfinding procedures ([algorithms](https://docs.falkordb.com/algorithms)). The plan doesn't need anything FalkorDB lacks.
- npm doesn't publish rate limits, and bulk work should use replicate.npmjs.com and back off on 429 responses ([apis.io](https://apis.io/rate-limits/npm/npm-rate-limits/), [npm blog](https://blog.npmjs.org/post/164799520460/api-rate-limiting-rolling-out)).
- I couldn't find any named WeMakeDevs winners ([Telegram](https://t.me/s/WeMakeDevs)). What the posts do show is judges praising heavy use of the sponsor's technology.

## SIMULATION (short)
- **Day 1:** The crawl runs for hours, and deduplicating version ranges into "latest" edges is fiddly.
- **Day 2:** The hook and MCP tool are easy, but they need a project subgraph built from `package.json`.
- **Day 3:** The canvas and replay probably slip.
- **Day 4:** Comparing against `npm ls --all` exposes mismatches with "latest-only" edges (ranges, optional and peer dependencies).

**Demo:** shot 2 is fragile if the candidate libraries add similar publisher counts.

**A judge's likely questions:**
1. "Does a lower count actually mean lower risk?"
2. "How is this different from Socket?"
3. "What about the lockfile?"
4. "Why is this a graph and not a script?"
5. "What does npm's new 2FA change?"

Answers 1, 2 and 5 are weak.

## STEELMAN / ATTACK
- **For:** The story is timely, the agent loop is concrete, every answer traces back to a path, the scope is honest, the cost is tiny, and it fits the track squarely.
- **Against:** The metric is a proxy that ignores the main defenses now in place. Close tools already exist. The demo's emotional punch depends on numbers nobody has seen yet.

## TOP 3 FLAWS
1. **The demo example collapses.** Date libraries mostly have zero dependencies, so on camera the agent compares 1 vs 1 publishers and there's nothing to see.
2. **The metric gets challenged.** A judge or Discord commenter points out that 2FA and trusted publishing are now required, and "every maintainer = attacker" sounds outdated.
3. **The prior-art question.** The judge asks "isn't this Socket's MCP server plus contributor-count?", and the answer, "we do it at install time", sounds thin.

## THE BEST VERSION
- **Cut:** the canvas polish.
- **Keep:** `compare_install`, the hook, and the worm replay. The replay is the most visual part.
- **Add:**
  - Before scripting the demo, find a real pair from the crawled data with a big difference in publishers (for example, a heavy utility library against a light one).
  - Add a "single-maintainer and stale-account" weighting so the score isn't a raw count.
  - Show a side-by-side "what Socket says vs. which paths we show" panel to make clear what's different.

## VERDICT
Build it with changes: the pitch is clear and the graph fits, but lock in a real high-contrast demo example and answer "why is a publisher count meaningful after npm's 2FA changes?" before building.
