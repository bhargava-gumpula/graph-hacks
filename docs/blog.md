---
title: A file lock would have said yes
published: false
description: Switchboard checks every coding-agent edit against the repo's import graph in FalkorDB, and refuses the one that would collide with another agent's work.
tags: ai, falkordb, typescript, agents
cover_image: https://switchboard-agents.xyz/og.png
---

# A file lock would have said yes

Agent A is changing `auth/session.ts`. Agent B asks to edit `ui/LoginForm.tsx`. They are different files, so a file lock says yes. Switchboard says no, and the check takes about a millisecond:

> Agent B cannot edit ui/LoginForm.tsx. It reaches auth/session.ts, which agent A is already changing, through ui/LoginForm.tsx → api/login.ts → auth/session.ts. A file lock would have allowed the edit.

![Agent B is refused ui/LoginForm.tsx because it imports auth/session.ts, which agent A holds](https://raw.githubusercontent.com/bhargava-gumpula/graph-hacks/main/docs/blog-assets/conflict.gif)

This post is about how a graph database makes that sentence possible, what we changed after a blind review, and what is still missing. We built it for Graph Hacks (WeMakeDevs × FalkorDB).

## The problem

We run several coding agents on one repository. They forget everything when a session ends, and they edit files that look independent and are not. The usual fixes are a lock on the filename and a human passing notes between agents. A filename lock cannot know that `LoginForm.tsx` imports `api/login.ts`, which imports `auth/session.ts`, so two agents can break each other without touching the same file.

## The graph model

Switchboard parses the repository into FalkorDB. Files are nodes and imports are edges. The demo repo is 35 files and 51 imports. An agent claims files before it edits them, and a claim is an edge, `(Agent)-[:CLAIMS]->(File)`, with an expiry time.

Everything else lives in the same graph. Decisions, lessons and handoffs are nodes. Every claim, refusal, edit and decision is also an `Event` node, numbered by a counter that is bumped in the same write that creates the event. Twenty concurrent writes came back numbered 1 to 20 with no gaps. FalkorDB is the only store. The dashboard follows that counter, so there is no second database and no message broker.

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

`(f)-[:IMPORTS*1..3]->(g)` walks up to 3 imports from the file you asked for. `(g)<-[c:CLAIMS]-(o)` ends on a file somebody holds. `c.until > $now` ignores expired claims, and `o.id <> $agent` ignores your own. The real query also runs with the arrow reversed, so that their file imports yours, and with no hops, for the very same file. It drops paths that run through a hub or use an `import type` edge. The full text is in the README, generated from the source.

If a row comes back, the row is the path, and the path is the refusal. If nothing comes back, that empty result is the proof that no live claim sits within 3 hops. The proof is only as good as the bound, so we say what the bound is wherever we show the result.

The check and the claim are one write query. FalkorDB runs the writes of one graph one at a time, so two agents asking for linked files at the same moment cannot both pass. A test fires ten claims at once at one file, and exactly one wins.

## One script hard-blocked two AI editors

Before we wrote the product, we tested whether an editor can be stopped at all. A probe script of about 40 lines told both Cursor and Claude Code that a file was claimed by another agent. Both refused the edit and passed our reason to the agent. The agent stopped and reported it. It did not retry.

Two surprises. Cursor also runs Claude Code's hook config, so one edit was checked twice. Our Claude hook now skips events that carry Cursor's `cursor_version` field. And Cursor runs the session-start hook but drops what it returns, so a briefing cannot be pushed into Cursor. The agent has to pull it with an MCP call.

So the hooks do the enforcing, because an agent forgets instructions, and the MCP server is for what an agent asks for on purpose: a brief, a decision, a handoff.

## What a blind review changed

On the last full day, a blind panel of five AI reviewers, each given a different point of view, rated the project from the live site and the repo. Ease of adoption scored lowest. These are the changes that came out of it.

**A refusal says what to do next.** A bare "no" left the agent stuck. Now the refused agent waits on the file that blocked it, a `WAITS_FOR` edge in the graph. The refusal names the holder, says when its claim runs out, and lists files from open tasks that are safe to take right now. The holder hears on its next edit that someone is waiting. When the holder releases, or its claim expires, the waiter is told the file is free.

**Shell writes count.** Agents also write files from the shell. Before a command runs, the hook claims its obvious write targets: redirections, `tee`, `sed -i`, `mv`, `cp`, `rm`, `touch`, `git checkout --`. After it runs, the files `git status` shows as changed are recorded as edits. A clever script can still write a file the hook did not guess, and that edit is recorded afterwards but was not checked first.

**Warn mode.** `SB_MODE=warn` lets every edit through and gives the agent the same text as a warning. It is for trying Switchboard on a real repo before letting it block anything.

**Two editors, two agents.** An agent's id is `<editor>@<branch>`, so Claude Code and Cursor on one branch are two agents that can block each other. `SB_AGENT` sets the id by hand.

**The graph follows the edits.** After each edit, that file's imports are updated in the graph, so a new import counts from the next check on.

**Rounds instead of components.** Which tasks can run together is also a graph question. One read query links two tasks when one's files reach the other's within 3 imports. We first split the links with `algo.WCC`, but a connected component runs a chain A-B-C one task at a time, though A and C never touch. Now a greedy colouring puts the tasks into rounds: the task with the most links goes first, and each takes the lowest round its neighbours leave free. Reading the rounds writes nothing.

**One graph per visitor.** On the public demo, one judge pressing Play used to reset what every other judge was watching. Now each visitor plays on a `GRAPH.COPY` of the demo graph, and idle copies are deleted.

**One graph for two laptops.** With FalkorDB Cloud, Claude Code on one machine and Cursor on another check against the same graph. From the laptop a query round trip to the cloud instance is about 44 ms, well inside the hook's time limit. The connection settings are read from four keys in a git-ignored `.env`, so no config file holds the password. For the demo we ran real Claude Code agents (`claude -p`) against the cloud graph. The Cursor side was driven through the exact hook commands Cursor runs, not by a live Cursor model.

## PageRank and hubs

`lib/utils.ts` is imported by 20 of the 35 files. If a path through it counted, every claim would conflict with every other. `algo.pageRank` scores each file over the import edges, and a rule flags the hubs: 10 or more importers, or at least 3 importers and a score at least 4 times the average. A path that runs through a hub in the middle does not count. Claiming the hub itself still conflicts with everything that imports it.

## Four FalkorDB gotchas

1. `shortestPath()` is allowed only in `WITH` and `RETURN`. Inside `MATCH` FalkorDB rejects it, and it cannot carry a hub filter anyway. We enumerate the paths, which is cheap at 3 hops, and keep the shortest in TypeScript.
2. A variable-length bound cannot be a parameter. `*1..$k` fails, so `k` is checked to be an integer from 1 to 5 and written into the query text.
3. In one projection, `same + count(c)` returned null, and a null guard let every claim through. A silent "safe" is the worst answer a coordination tool can give. Each count now has its own `WITH`, and the filter comes after the last one.
4. `algo.pageRank` errors on a graph with no `File` nodes. We count the files first.

## The graph caught a bug in our own test data

The demo repo has two features that are meant to be independent, so the scheduler can show they are safe to run in parallel. Checked against the import graph, they were not. Both imported one shared types file through type-only imports, so they were two hops apart, and a scheduler that links files in either direction would have put both features in one batch. A file lock would never have noticed. We moved the settings types into the settings feature's own file.

## The benchmark, and what it does not prove

Our first benchmark had a flaw we found ourselves. Agent B's edit deleted an import and left the call, so the build broke whether or not agent A existed.

The rebuilt version is a real merge collision. Agent A changes what `sessionLabel` in `session.ts` returns. Agent B edits `LoginForm.tsx` to use that value. Each edit passes the TypeScript compiler on its own, and merged they fail. Ten times, we apply the edits to a copy of the demo repo and run the real `tsc`.

Without Switchboard, a plain file lock lets B in, nothing checks the merge, both edits land, and the build breaks ten times out of ten. With Switchboard, B's claim is refused while A holds `session.ts`. A's edit lands and A releases. Then B claims, applies its edit on top of A's, and its own `tsc` run catches the clash. No build breaks.

That 0 out of 10 is not something only Switchboard can do. A CI job running `tsc` on the merge would also keep the broken build out of `main`, but only after both agents had finished, and then B's change has to be redone on top of A's. What Switchboard changes is when B finds out: before it writes a line, with the import path in the refusal.

It is also a scripted benchmark. The agents are not live models, it is one scenario on a 35-file repo, and it is deterministic, so ten runs show that it repeats, not a statistic.

One number is not scripted. We count every pair of files in the demo repo: 595 pairs, and 72 of them are linked by imports within 3 hops, counted by the conflict check's rules. For 24 of those 72 the files are 2 or 3 hops apart, so a one-hop checker misses them, and a file lock misses all 72.

## What is still missing

- **Merges.** A claim ends when the session ends or the claim expires, not when the work is merged. With one worktree per agent, B can be told a file is free while its worktree does not have A's commit yet. B still has to rebase before it builds on A's change.
- **Over-blocking.** We have not measured how often a refusal stops an edit that would have been fine. Fewer hops (`SB_HOPS`) means fewer refusals and more missed collisions.
- **Granularity.** Claims are per file, so two agents in different functions of one file still conflict, and two files that share only a database table never do. Only TypeScript and JavaScript are parsed.
- **Dogfooding.** We did not use Switchboard to coordinate its own build, beyond parsing our own repo.

Next is a tree-sitter parser for more languages, symbol-level claims (the import edges already store the imported names), and a check that a waiting agent has the holder's commit before it goes ahead.

## Try it

- Live demo, nothing to install: https://switchboard-agents.xyz/app?play=1
- Claude Code: `/plugin marketplace add bhargava-gumpula/graph-hacks`, then `/plugin install switchboard@switchboard`. It needs Node 22 and a FalkorDB, for example `docker run -d -p 6379:6379 falkordb/falkordb`.
- Cursor and other editors, and why each design choice was made: https://github.com/bhargava-gumpula/graph-hacks
- Video: TBD

## AI disclosure

AI coding agents wrote almost all of the code: Cursor (Claude Opus 5.5 and Grok 4.7) and Claude Code. They also drafted this post. I chose the idea and the tracks, required that FalkorDB be the only store and that claims be checked against the parsed import graph, chose to add the benchmark and the optional AI summary, ran the editor tests that needed a person, and directed the UI rebuild. The first code commit came after the hackathon start, and every earlier commit is notes. The only model call inside the product is an optional Claude Haiku summary of a briefing, off unless an API key is set.
