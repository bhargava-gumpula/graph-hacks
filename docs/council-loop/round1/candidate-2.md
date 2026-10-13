# Council brief: one hackathon idea

This brief describes one idea, with no scores, risks or recommendations attached. Find the strengths and flaws yourself.

## The hackathon (facts)
- **Graph Hacks: Context for AI Agents**, run by WeMakeDevs and sponsored by FalkorDB (an open-source, in-memory graph database queried with Cypher). Online. About 3,000 registrants. Judges are presumably WeMakeDevs and FalkorDB people. **No judging rubric has been published.**
- **Timing:** coding starts Tue Oct 14, 11:31 AM PT. The deadline is Sat Oct 18, 11:29 AM PT (about 4 days).
- **Three tracks, one prize each; a project may enter several:**
  1. *Agents That Act on Connected Data* (iPhone 18 Pro): multi-hop reasoning, graph queries and algorithms as agent tools, tool selection via MCP, actions driven by the graph, explainable results.
  2. *Agent Memory and Coordination* (PS5): episodic, semantic and procedural memory; persistent history; shared state and handoffs between agents; high-concurrency reads and writes; separate memory per user or tenant.
  3. *Company Brain* (M6 Mac Mini): docs, tickets and chats in one graph; who owns and knows what; tracing decisions to their source; keeping knowledge current; answers with sources.
- **Rules:**
  - FalkorDB must be central: "if the product still works once FalkorDB is taken out, the graph is decoration."
  - Data must be public, synthetic or your own.
  - AI coding assistants are allowed but must be disclosed, and entrants must be able to explain the graph model, queries and architecture.
  - Fully AI-generated projects without meaningful contribution may be rejected.
- **Submission:** a public repo, a README with setup and the graph model, the Cypher queries, a demo video, and a live deployment (preferred) or full local setup.

## The builder
- One person who directs several Claude Code agents in parallel (Claude Code runs on their subscription). They will build with AI assistance and must be able to explain every design decision.
- Product runtime budget: about $30 of Claude API spend over the whole event, including the live demo. Anthropic has no embeddings API, so any embeddings are computed locally.
- Demo host: a spare always-on Mac running FalkorDB in Docker, exposed through a Cloudflare Tunnel.
- Their deciding question includes **real-world usefulness**: who would actually use this?

## The idea: an issue-triage agent that finds the real expert for a public open-source repository
Treat one public GitHub repository as "the company". Ingest about two years of its history into FalkorDB and use graph algorithms to answer "who really knows this code?" so a new issue can be routed with evidence.

- **Repository choice:** one mid-size repository with genuinely distributed ownership, picked on day 1 by a simple test: at least 30 people who authored or reviewed merged PRs in the last two years, and a CODEOWNERS file or documented area maintainers to compare against (candidates: vitejs/vite, pydantic/pydantic).
- **Graph model:**
  - `(:Person)-[:AUTHORED]->(:PR)`, `(:Person)-[:REVIEWED {state}]->(:PR)`, `(:PR)-[:TOUCHES]->(:File)`, `(:Issue)-[:FIXED_BY]->(:PR)` (from "Fixes #n" links), `(:File)-[:IN]->(:Component)`, `(:Person)-[:DECLARED_OWNER]->(:Component)` (from CODEOWNERS).
  - Derived edges: `(:File)-[:CO_CHANGED {weight}]->(:File)` and `(:Person)-[:CO_REVIEWED {weight}]->(:Person)`.
  - Human corrections as facts with valid-from and valid-to times: `(:Person)-[:OWNS {valid_from, valid_to, source:'correction'}]->(:Component)`.
- **What it does:**
  - **Components derived, not guessed:** label propagation on the co-change graph groups files into components, compared side by side with the folder structure.
  - **Real experts:** PageRank on authorship and review edges within a component, weighted by recency, ranks experts. Next to the declared owner, it shows "ownership drift" (the declared owner hasn't touched the area in 12 months) and a bus factor per component (how many top people cover 80% of the activity).
  - **Triage path:** for a new issue, it finds the closest past issues (local embeddings plus shared file paths), follows them to the PRs that fixed them, the files those touched, the component and its experts, and drafts a triage comment that cites each hop (a draft only, never posted). Claude is called only to extract the component hint from the issue text and to write the draft.
  - **Corrections:** "Carol owns the dev-server now" is stored as a timestamped fact; the next answer changes and shows why, and the old answer stays queryable "as of" a past date.
  - **3 MCP tools:** `find_expert(component|path)`, `triage(issue_url)`, `why_owner(person, component)`, usable from Claude Desktop or Claude Code.
- **Data:** the public GitHub REST/GraphQL API (authenticated, 5,000 requests per hour), ingested once, then updated by polling.
- **Verification:** 20 past issues whose real reviewer is known are used as a hand-checked test set, and the hit rate is reported in the README.
- **Planned 2-minute demo:** a real recent issue is pasted in; the graph canvas draws issue → similar past issue → fixing PR → files → component → experts, with the Cypher shown; the declared owner is greyed out with "no activity in 14 months"; a maintainer correction is typed in and the answer changes live.
- **Out of scope:** multiple repositories, Slack or Discord, auto-posting, full decision extraction from all discussions.
- **Intended tracks:** Company Brain (main), Agents That Act on Connected Data.
