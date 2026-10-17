# Graph Hacks: Context for AI Agents (WeMakeDevs × FalkorDB)

Researched 2026-10-11 from the official pages. The official site wins over any listing that disagrees with it.

- Site (register + submit here): https://www.wemakedevs.org/hackathons/falkordb (rules: /rules, schedule: /schedule, resources: /resources, submit: /submit)
- Luma (reminders only, does NOT register you): https://luma.com/graph-hacks
- FalkorDB Discord (help + team finding): https://discord.com/invite/Y2mMT9VdMy · WeMakeDevs Discord: https://discord.gg/wemakedevs

## Dates (owner is on Pacific time)
| | IST (official) | Pacific (PDT) |
|---|---|---|
| Hacking starts | Oct 15, 12:01 AM | **Wed Oct 14, 11:31 AM** |
| Submissions close | Oct 18, 11:59 PM | **Sun Oct 18 11:29 AM PT** |

Luma shows Oct 15 8 AM → Oct 18 8 PM PT. Ignore that and plan for the **Sun Oct 18 11:29 AM PT** deadline. Our internal deadline is **Sun Oct 18 10:30 AM PT**, an hour earlier. No kickoff time has been published yet (the FAQ mentions a kickoff session).

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

## Our infrastructure decisions (2026-10-11)
- FalkorDB: free, open source, runs locally in Docker (OrbStack on the dev Mac).
- Live demo host: the owner's **other Mac** (always on) running FalkorDB + the app, exposed with a **Cloudflare Tunnel** on the owner's free .xyz domain (to be confirmed). It must stay up until judging ends (a few weeks after Oct 18).
- Host Mac setup: never sleep, auto-restart after a power failure, containers restart on boot, auto-updates off until judging ends.
- Protect the $100 API credits: per-visitor rate limit, a hard daily spending cap, and a static fallback (pre-saved example answers and graph views) shown when the cap is hit or the host is down.
- **Installed 2026-10-13 (dev Mac):** OrbStack (Docker 29.8.2; CLI at ~/.orbstack/bin/docker) and cloudflared 2026.10.0. The falkordb/falkordb:latest image is pulled, and a smoke test passed (create a graph plus a variable-length path query, both under 1 ms). The demo-host Mac still needs the same setup.

## Rules check, 2026-10-13 evening (site + WeMakeDevs Discord via Aside; FalkorDB Discord not joined)
- **The deadline is confirmed:** Oct 18, 11:59 PM IST = **Sun Oct 18 11:29 AM PT**. The site overview itself says "Oct 14, 11:31 AM to Oct 18, 11:29 AM PDT". Luma's 8 AM–8 PM is wrong; the site governs.
- **The owner is registered** (site: "Registered"; Luma: "You're In").
- **The submission form isn't open yet** (it opens at the start), so its fields and any video length limit are unknown.
- **Judging:** no rubric is published. Oct 8 announcement (Kunal): every judged project gets **a public score and judge feedback, and the judges are listed publicly** on the hackathon site. No list is up yet.
- **No kickoff time is published.** No rule changes in WeMakeDevs channels over the last two weeks.
- **Blog prize:** AirPods 5 is on the overview only, with no criteria, platform or deadline stated.
- **AI disclosure** is required, but how is unspecified. Plan: a README section listing the tools and what the owner did.
- **Open:** join the FalkorDB Discord (owner's choice) to ask organisers about the video length, blog rules and judging.
