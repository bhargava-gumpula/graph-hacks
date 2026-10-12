# Graph Hacks: Context for AI Agents (WeMakeDevs × FalkorDB)

Researched 2026-10-11 from the official pages. The official site wins over any listing that disagrees with it.

- Site (register + submit here): https://www.wemakedevs.org/hackathons/falkordb (rules: /rules, schedule: /schedule, resources: /resources, submit: /submit)
- Luma (reminders only, does NOT register you): https://luma.com/graph-hacks
- FalkorDB Discord (help + team finding): https://discord.com/invite/Y2mMT9VdMy · WeMakeDevs Discord: https://discord.gg/wemakedevs

## Dates (owner is on Pacific time)
| | IST (official) | Pacific (PDT) |
|---|---|---|
| Hacking starts | Oct 15, 12:01 AM | **Tue Oct 14, 11:31 AM** |
| Submissions close | Oct 18, 11:59 PM | **Sat Oct 18, 11:29 AM** |

Luma shows Oct 15 8 AM → Oct 18 8 PM PT. Ignore that and plan for the **Sat 11:29 AM PT** deadline. Our internal deadline is **Fri Oct 17, 11 PM PT**. No kickoff time has been published yet (the FAQ mentions a kickoff session).

## Format
Online, free, solo or a team of up to 4 (each person can be on one team only). Registered entrants: 3,000+ at last count.

## Tracks and prizes ($20k pool; every member of a winning team gets the prize; you may enter several tracks)
1. **Agents That Act on Connected Data** (iPhone 18 Pro). Multi-hop reasoning, graph queries and algorithms as agent tools, tool selection via MCP, actions driven by the graph, explainable results. Examples: fraud, security triage, codebase.
2. **Agent Memory and Coordination** (PS5 + GTA VI). Episodic, semantic and procedural memory; persistent history; shared state and handoffs between agents; high-concurrency reads and writes; a separate memory per user or tenant.
3. **Company Brain** (M6 Mac Mini). Docs, tickets and chats in one graph; who owns and knows what; tracing decisions to their source; keeping knowledge current; answers with sources.
- Side prizes: **AirPods 5 for the best blog post** about the project; a t-shirt for each member of the top 50 teams.

## Rules that constrain us
- FalkorDB must be the **primary** graph DB and central to the product. "If the product still works once FalkorDB is taken out, the graph is decoration." Docker, self-hosted or FalkorDB Cloud are all fine.
- **The main coding and design work must start after the start time.** Allowed before then: ideas, notes, sketching the graph model, diagrams. Reusing general libraries, templates and infrastructure is fine.
- Data must be public, synthetic or our own. Nothing private, behind a login or paywall, or personal.
- AI coding assistants are allowed but **their use must be disclosed**. Participants must be able to explain the graph model, queries, architecture and decisions. Projects "entirely generated using AI without meaningful participant contribution" may be rejected. → The owner must understand and own the design; we keep an AI-use note and a decisions log.
- Name every track entered when submitting.

## Submission checklist
- [ ] Public source repo
- [ ] README: setup instructions + **graph data model**
- [ ] The **Cypher queries / graph algorithms** the product depends on
- [ ] Demo video of the working project
- [ ] Live deployment (preferred), or complete local setup instructions
- [ ] Track(s) named
- [ ] AI-assistant disclosure
- [ ] (Side prize) blog post

## Judging
No rubric has been published. Inferred from the brief: the graph does real work, decisions are traceable ("show the path behind an answer"), it's a working agent, the demo is clear, and it's deployed. Ask in the Discord.

## FalkorDB quick facts (from the event pages)
Open source, Cypher, fast traversals, many isolated graphs in one instance (one per user, agent or tenant). Built-in algorithms: shortest path, PageRank, centrality, connected components, community detection. Integrations: GraphRAG-SDK, QueryWeaver (text-to-SQL), MCP, Graphiti, Cognee, LangChain, LlamaIndex. Clients: Python, Node, Java, Rust, Go, PHP, C#. FalkorDB Browser for exploring. `docker pull falkordb/falkordb:latest` · Cloud: https://app.falkordb.cloud · Docs: https://docs.falkordb.com
