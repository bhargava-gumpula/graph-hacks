# Project ideas (2026-10-11, pre-event: ideas and notes only, no code)

Scoring, 1–5 each: **Graph** (does the graph do real, irreplaceable work?), **Demo** (wow in 2 min), **Fit** (tracks it genuinely qualifies for), **Unique** (vs ~3,000 registrants), **Feasible** (4 days, $100 Claude credits, public/synthetic data).

Crowded ideas we'd lose in: generic fraud-ring detector, "chat with your Notion/Slack docs", a plain GraphRAG chatbot.

---

## A. Maintainer Brain: a company brain for a real open-source org ⭐ top pick
**Primary: Track 3 Company Brain (Mac Mini). Also: Track 1 (it acts), Track 2 (remembers).**

Treat a public GitHub org as "the company", ideally **FalkorDB's own org** (the judges know it better than anyone). Ingest issues, PRs, commits, reviews, discussions, docs and release notes into one graph:
`(Person)-[:AUTHORED|REVIEWED]->(PR)-[:TOUCHES]->(File)-[:PART_OF]->(Component)`, `(Issue)-[:FIXED_BY]->(PR)`, `(Decision)-[:DECIDED_IN]->(Discussion)`, `(Release)-[:SHIPS]->(PR)`.

- **Asks:** "Who knows the vector index code?" "Why was X changed in v4.2? Show me the source." "What else breaks if we change this file?"
- **Acts:** when a new issue arrives, it finds the component, similar past issues and their fixes, and the best reviewer (by who actually touched the code recently), then drafts a triage comment with sources. Draft only, never auto-posted.
- **Remembers:** maintainer corrections ("no, Alice owns that now") become graph facts that override old data, with timestamps.
- **Graph does real work:** ownership and expertise are multi-hop paths; remove the graph and the answers vanish.
- **Data:** public GitHub API, which the rules allow.
- **Risk:** ingestion quality; keep it to one or two repos.

| Graph | Demo | Fit | Unique | Feasible |
|---|---|---|---|---|
| 5 | 5 | 5 (3 tracks) | 4 | 4 |

## B. Switchboard: a shared graph memory for teams of coding agents
**Primary: Track 2 Memory and Coordination (PS5). Also: Track 1 (MCP tools).**

What we do ourselves: several Claude agents working on one codebase. Switchboard is an **MCP server backed by FalkorDB** that every agent reads and writes: tasks, claims on files, decisions, handoffs, failures, "lessons learned" (procedural memory).
- Stops two agents editing the same file (it checks claims through the graph).
- A new or cleared agent asks "what do I need to know about this module?" and gets the decisions, gotchas and who changed what, across sessions.
- A separate memory graph per project or tenant (FalkorDB multi-graph).
- **Demo:** three live Claude Code agents coordinating through it, with the graph updating in real time.
- **Risk:** the demo is more technical; it's harder to show the "wow" to non-developers.

| Graph | Demo | Fit | Unique | Feasible |
|---|---|---|---|---|
| 4 | 4 | 4 (2 tracks) | 5 | 4 |

## C. Blast Radius: an on-call incident agent
**Primary: Track 1 Connected Data (iPhone). Also: Track 3 (owners and runbooks), Track 2 (incident memory).**

A graph of services → dependencies → deploys → owners → runbooks → past incidents, using a public demo system (OpenTelemetry Demo or Online Boutique) plus synthetic incidents.
- An alert fires; the agent walks the dependency graph, finds the most likely cause (a recent deploy upstream), the owner, a similar past incident and its fix, then pages and drafts the rollback.
- "What breaks if payments goes down?" is one traversal, shown animated.
- **Risk:** synthetic data can look staged, and others will do "SRE agent".

| Graph | Demo | Fit | Unique | Feasible |
|---|---|---|---|---|
| 5 | 5 | 5 | 3 | 4 |

## D. CVE Path Finder: dependency security triage
**Primary: Track 1 (iPhone; "triage security findings" is in the brief).**

Public advisory data (OSV) plus the dependency trees of real public projects. For a new CVE: which projects are affected, **through which transitive path**, how far down, who maintains each hop, and what is the smallest upgrade that fixes it. It acts by drafting the upgrade PR or issue.
- **Risk:** narrower (one track); it's a "tool" more than an "agent that remembers".

| Graph | Demo | Fit | Unique | Feasible |
|---|---|---|---|---|
| 5 | 4 | 3 | 4 | 4 |

---

## Recommendation
**A (Maintainer Brain)**: entered in Tracks 3 + 1 (+2). It aims straight at the Mac Mini, the brief lists all its features nearly word for word, it uses real public data, and it's built on the sponsor's own repo.
Runner-up: **B** if you'd rather go for the PS5. Parts of A and B overlap (memory, corrections), so either way we keep the other's best bits.

Pre-event work allowed: pick the idea, sketch the graph model, draw the architecture, plan the demo script. Code starts Tue 10/14, 11:31 AM PT.
