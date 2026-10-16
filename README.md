# Switchboard

Switchboard checks an AI coding agent's edit against the repository's real import graph. If the edit would collide with another agent's in-flight change, FalkorDB returns the import path and the edit stops. A file lock only sees the filename.

Tracks: **Agent Memory and Coordination** (main) and **Agents That Act on Connected Data**.

## The one-minute demo

```bash
docker compose up -d
npm install
npm run server    # http://localhost:8787
npm run web       # http://localhost:5173
```

Open http://localhost:5173 and press **Play the demo**.

Agent A claims `auth/session.ts`. Agent B asks for `ui/LoginForm.tsx`. Those are different files. The graph refuses, because LoginForm imports `api/login.ts`, which imports `session.ts`. The page says so in one sentence and draws that path in red.

- `/` is the landing page. The three numbers come from `bench/results.json`.
- `/app` is the graph.
- `/judge` is three buttons: Conflict, Batches, Why.

`npm run scenario` prints the same story in the terminal.

## Setup

Node 22 or newer. Docker, for FalkorDB.

```bash
npm run db:up          # FalkorDB on ports 6379 and 3000
npm test               # queries run against that database
npm run parse -- demo-repo
```

Environment (see `.env.example`):

| Variable | Meaning |
|---|---|
| `FALKORDB_URL` | default `redis://localhost:6379` |
| `SB_GRAPH` | one FalkorDB graph per project, default `sb_demo` |
| `SB_PREFIX` | directory stripped from editor paths before a check. `demo-repo` for this repo |
| `SWITCHBOARD_OFF` | set to `1` to let every edit through |
| `ANTHROPIC_API_KEY` | optional. If set, a briefing gets a short Haiku summary. If unset, the graph text is the whole answer |

## Graph model

One FalkorDB graph per project. Nothing is shared across graphs.

Nodes: `File`, `Agent`, `Task`, `Decision`, `Lesson`, `Event`, `Meta` (the `seq` counter).

Edges that matter:

| Edge | Meaning |
|---|---|
| `IMPORTS` | parsed from the code |
| `CLAIMS` | an agent is editing that file until `until` |
| `TOUCHES` | a task's planned files |
| `INTERFERES` | two open tasks can reach each other through imports |
| `EDITED` | an agent wrote the file |
| `AFFECTS` | a decision applies to a file |
| `CAUSED_BY` | a task exists because of a decision |
| `ABOUT` | a lesson applies to a file |
| `BY` / `ON` / `UNDER` | an event's agent, file, and task |
| `HANDED_OFF` | one agent gave a task to another |
| `SUPERSEDES` | a newer decision replaced an older one |

`Event.seq` is allocated in the same write as the event, so the log has no gaps. The web server polls `seq` and pushes new events over SSE. There is no second database and no message broker. Remove FalkorDB and the claim check, the feed, the canvas, the batches, the why-trace, and the briefing all stop.

## Queries

All of them live in `packages/core/src/queries/`.

**Conflict.** For each file an agent wants, find another agent's unexpired claim on that file, or within 3 import hops in either direction. Hubs are skipped on multi-hop paths. Empty result means the claim is safe and is written. A path means the claim is refused and a `conflict` event stores the path.

**Blast radius.** Files that import a file, hop by hop. Zero rows means nothing depends on it.

**Batches.** Rebuild `INTERFERES` between open tasks whose files can reach each other, hubs excluded, then `algo.WCC` on those edges. Different components can run at the same time.

**Hubs.** `algo.pageRank` on `File` / `IMPORTS`. A file imported 10 or more times is a hub (`lib/utils.ts` in the demo). Hubs do not glue unrelated tasks together.

**Why.** The edit event on a file, the agent, the task, and the decision that caused the task.

**Briefing.** For a task or a directory: nearby claims, decisions, lessons, recent events, open tasks, and the latest handoff note.

## Benchmark

```bash
npm run bench
```

Ten trials. Each one copies `demo-repo`. Agent A has claimed `auth/session.ts`. Agent B's edit deletes an import and leaves the call, so `tsc` fails if the edit lands. Without Switchboard the edit is applied. With Switchboard the conflict check blocks it. The numbers in `bench/results.json` and on the landing page are whatever that command last wrote. See `bench/REPORT.md`.

This is a scripted pair of agents, not twenty live model sessions. The only difference between the columns is whether the edit obeys the graph.

## AI disclosure

Coding agents (Cursor, Claude Code) wrote most of this repository. The owner chose the product, the tracks, and the rule that FalkorDB is the only store, and reviewed the demo story.

Inside the product, the only model call is an optional Claude Haiku summary of a briefing (`packages/core/src/summarize.ts`). It does not run unless `ANTHROPIC_API_KEY` is set. The graph result is still the answer. The conflict check, the batches, and the why-trace do not call a model.

## What the human directed

The owner picked Switchboard after comparing several hackathon ideas, named the two tracks, and required that claims be checked against a parsed dependency graph rather than a lock table. The demo conflict (`LoginForm` → `login` → `session`) is the story they wanted a judge to see. A shared types file that accidentally connected the "independent" settings island to the login chain was caught by reading the import graph and moved.

## Competitors

No other tool we looked at checks an agent's claim against a parsed import graph and keeps decisions, lessons, and edit history in that same graph database. Nerveplane uses hand-declared scopes and SQLite. wit warns about one hop and has no memory. A filename lock, including Claude Code agent teams, cannot express "these files look independent and are three imports apart."
