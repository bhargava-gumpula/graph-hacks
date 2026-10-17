# Submission form answers (draft)

The form at https://www.wemakedevs.org/hackathons/falkordb/submit is open. The owner is signed in and registered. Submissions can be edited until **Sun Oct 18, 11:29 AM PT**. Paste these in, then check every number against the merged code.

Rules to remember: the repo must be **public** with a README (setup steps, graph data model, the Cypher used, the demo video, a live deployment or full local setup, the track). AI coding tools are allowed but must be disclosed. You must be able to explain the code and the graph model, and mostly AI-generated projects may be rejected. Read `docs/JUDGE-QA.md` before recording the video.

## Project title (required)
Switchboard

## Description (required)
> Hint: what problem does your project solve, and who is it for?

Teams that run several AI coding agents at once (Claude Code, Cursor) hit a quiet failure: each agent's change is fine alone, but two changes three imports apart break the build after both merge. Worktrees and file locks don't see it, because the agents never touch the same file.

Switchboard gives the agents one shared FalkorDB graph: the repo's import graph, who has claimed which file, and the team's decisions, lessons and events. Before an agent edits a file, a hook asks the graph whether any import path connects that file to another agent's claim. If one does, the edit is refused and the agent is told the exact path and who holds the other end. The same graph briefs a replacement agent, explains why a file looks the way it does, shows the blast radius of a change, and splits tasks into batches that can safely run in parallel.

It's for developers and small teams who already run more than one coding agent on the same repo.

## Track (required)
- [x] Agent Memory and Coordination (main)
- [x] Agents That Act on Connected Data

## Repository (required)
https://github.com/bhargava-gumpula/graph-hacks (make it public first)

## Demo video (required)
YouTube link, public or unlisted. Script: `docs/DEMO.md`. Draft cut: `video/out/explainer.mp4`.

## Live demo or deployment (optional)
The deployed URL (domain pending). Local setup is in the README either way.

## How did you use FalkorDB in your project? (required)
> Hint: what technical problems you solved using FalkorDB

- **Conflict detection is one path query.** `MATCH p = (f:File {path: $want})-[:IMPORTS*1..3]->(g:File)<-[c:CLAIMS]-(o:Agent)` finds any other agent's live claim up to three imports away, and returns the path as the reason the edit was refused. It runs in under a millisecond on the demo repo.
- **Claims are atomic.** The check and the claim run as a single write query, so a race can't produce two holders (a test runs ten agents for the same file and exactly one wins).
- **Hub files don't block everyone.** `algo.pageRank('File','IMPORTS')` marks heavily imported files (like `utils.ts`) as hubs, and conflict paths skip them.
- **Parallel batches.** Tasks that interfere become `INTERFERES` edges; `algo.WCC` splits the rest into batches that can run at the same time.
- **Memory in the same graph.** Decisions, lessons and events are nodes linked to files, agents and tasks. A why-trace walks file → edit → task → decision; a briefing for a new agent gathers claims, recent decisions and lessons near the files it will touch. Full-text indexes cover decisions and lessons.
- **Live feed.** Every claim, refusal and edit is an event node with a gapless sequence number that the dashboard streams.

## Blog link (optional)
The published post (dev.to or Hashnode). Draft: `docs/blog.md`. Best blog wins AirPods 5.

## What did you like about FalkorDB? (required)
(Owner's words.) Ideas: variable-length paths made the core check one readable query; `algo.pageRank` and `algo.WCC` run in the database, so there was no export to another tool; it starts in one Docker container and many isolated graphs live in one instance (tests each get their own).

## What improvements would you like to see in FalkorDB? (required)
(Owner's words.) Ideas we actually hit:
- An aggregation projection over an empty match returned null instead of an empty row, and `WITH … WHERE` followed by `MATCH` dropped rows, so we rewrote those queries.
- `CALL db.idx.fulltext.createNodeIndex` from older docs isn't accepted; `CREATE FULLTEXT INDEX` is. The docs could say which is current.
- `algo.pageRank` errors on a graph with no matching nodes instead of returning nothing.
