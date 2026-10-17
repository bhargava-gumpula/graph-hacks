# A file lock would have said yes

Agent A is changing `auth/session.ts`. Agent B asks to edit `ui/LoginForm.tsx`. They are different files, so a file lock says yes. Switchboard says no, and the check takes about a millisecond:

> Agent B cannot edit ui/LoginForm.tsx. It reaches auth/session.ts, which agent A is already changing, through ui/LoginForm.tsx → api/login.ts → auth/session.ts. A file lock would have allowed the edit.

This post is about how a graph database makes that sentence possible, and what we got wrong on the way.

## The problem

We run several coding agents on one repository. They forget everything when a session ends, and they edit files that look independent and are not. The usual fixes are a lock on the filename and a human passing notes between agents. A filename lock cannot know that `LoginForm.tsx` imports `api/login.ts`, which imports `auth/session.ts`, so two agents can break each other without touching the same file.

## The graph model

Switchboard parses the repository into FalkorDB. Files are nodes and imports are edges. The demo repo is 35 files and 51 imports. An agent claims files before it edits them, and a claim is an edge, `(Agent)-[:CLAIMS]->(File)`, with an expiry time.

Everything else lives in the same graph. Decisions, lessons and handoffs are nodes. Every claim, refusal, edit and decision is also an `Event` node, numbered by a counter that is bumped in the same write that creates the event. Twenty concurrent writes came back numbered 1 to 20 with no gaps. FalkorDB is the only store. The page follows that counter, so there is no second database and no message broker.

## The one query

This is the UPSTREAM branch of the conflict query, trimmed:

```cypher
UNWIND $paths AS want
MATCH p = (f:File {path: want})-[:IMPORTS*1..3]->(g:File),
      (g)<-[c:CLAIMS]-(o:Agent)
WHERE o.id <> $agent AND c.until > $now
RETURN want AS file, g.path AS claimed,
       [n IN nodes(p) | n.path] AS path, length(p) AS hops, o.id AS agent
```

`(f)-[:IMPORTS*1..3]->(g)` walks up to 3 imports from the file you asked for. `(g)<-[c:CLAIMS]-(o)` ends on a file somebody holds. `c.until > $now` ignores expired claims, and `o.id <> $agent` ignores your own. The real query also runs with the arrow reversed, so that their file imports yours, and with no hops, for the very same file, and it drops paths that run through a hub. The full text is in the README, generated from the source.

If a row comes back, the row is the path, and the path is the refusal. If nothing comes back, that empty result is the proof that no live claim sits within 3 hops. We show the bound on screen, because the proof is only as good as the bound.

## One bash script hard-blocked two AI editors

Before we wrote the product, we tested whether an editor can be stopped at all. A probe script of about 40 lines told both Cursor and Claude Code that a file was claimed by another agent. Both refused the edit and passed our reason to the agent. The agent stopped and reported it. It did not retry.

Two surprises. Cursor also runs Claude Code's hook config, so one edit was checked twice. Our Claude hook now does nothing when the input carries Cursor's `cursor_version` field. And Cursor runs the session-start hook but drops what it returns, so a briefing cannot be pushed into Cursor. The agent has to pull it with an MCP call.

## WCC and PageRank

Which tasks can run together is also a graph question. We plan five tasks. FalkorDB connects two of them when one's files can reach the other's through imports, and `algo.WCC` splits the result into connected components. We get three groups: the login chain together, the settings pair together, and the about page alone. Nobody typed the groups.

PageRank answers a different question. `lib/utils.ts` is imported by 20 of the 35 files. If you follow imports in both directions, as the briefing does, that one file puts all 20 importers within two hops of each other and would pull files from all over the repo into every briefing. `algo.pageRank` scores each file, and a rule flags the hubs: 10 or more importers, or at least 3 importers and a score at least 4 times the average. A path that runs through a hub in the middle does not count.

## Four FalkorDB gotchas

1. `shortestPath()` is allowed only in `WITH` and `RETURN`. Inside `MATCH` FalkorDB rejects it, and it cannot carry a hub filter anyway. We enumerate the paths, which is cheap at 3 hops, and keep the shortest in TypeScript.
2. A variable-length bound cannot be a parameter. `*1..$k` fails, so `k` is checked to be an integer from 1 to 4 and written into the query text.
3. In one projection, `same + count(c)` returned null, and a null guard let every claim through. A silent "safe" is the worst answer a coordination tool can give. Each count now has its own `WITH`, and the filter comes after the last one.
4. `algo.pageRank` errors on a graph with no `File` nodes. We count the files first.

## The graph caught a bug in our own test data

The demo repo has two features that are meant to be independent, so the scheduler can show they are safe to run in parallel. We checked the import graph by hand and they were not independent. Both imported one shared types file, through type-only imports, so they were two hops apart. The scheduler we had planned linked two files whenever imports connected them in either direction, so a connected-components pass would have put both features in one batch. A file lock would never have noticed. We moved the settings types into the settings feature's own file.

## The honest benchmark

Our first benchmark had a flaw we found ourselves. Agent B's edit deleted an import and left the call, so the build broke whether or not agent A existed. "10 of 10 broke without, 0 of 10 with" proved very little.

The rebuilt version is a real merge collision. Agent A changes what `sessionLabel` in `session.ts` returns. Agent B edits `LoginForm.tsx` to use the new value. Each edit passes the TypeScript compiler on its own, and merged they fail. Ten times, we apply the edits to a copy of the demo repo and run the real `tsc`.

Without Switchboard, a plain file lock lets B in, both edits land, and the build breaks ten times out of ten. With Switchboard, B's claim is refused while A holds `session.ts`. A's edit lands and A releases, and then B claims, applies its edit on top of A's, and its own `tsc` run catches the clash. No build breaks.

It is still a scripted benchmark. The agents are not live models, it is one scenario on a 35-file repo, and it is deterministic, so ten runs show that it repeats, not a statistic.

One number is not scripted. We count every pair of files in the demo repo: 595 pairs, and 78 of them are linked by imports within 3 hops. For 27 of those 78 the files are 2 or 3 hops apart, so a one-hop checker misses them, and a file lock misses all 78. The tables are in `bench/results.json` and `bench/pairs.json`, and the README generates its numbers from them.

## What we cut and what is next

We left out symbol-level claims, so two agents in different functions of one file still conflict, and every language but TypeScript. We cut three UI mockups, and the page was rebuilt once from scratch. We did not use Switchboard to coordinate its own build, beyond parsing our own repo once.

Next is a tree-sitter parser for more languages, symbol-level claims, and re-parsing a file when it changes instead of on demand.

## Links

- Code: https://github.com/bhargava-gumpula/graph-hacks
- Live demo: https://switchboard.bhargava-gumpula.com/app?play=1
- Video: TBD

## AI disclosure

AI coding agents wrote most of the code: Cursor (Claude Opus 5.5 and Grok 4.7) and Claude Code. The owner made the product decisions, ran the editor tests that needed a person, and directed the UI rebuild. The first code commit came after the hackathon start, and every earlier commit is notes. The only model call inside the product is an optional Claude Haiku summary of a briefing, off unless an API key is set.
