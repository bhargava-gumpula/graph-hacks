# Graph Hacks idea research (fresh, un-anchored)

Researched 2026-10-13. ~60 searches/fetches plus live API probes. Written without reading docs/COUNCIL.md, docs/IDEAS.md or the briefs.

Constraints assumed: one builder directing coding agents, Oct 14 11:31 AM PT → Oct 18 11:29 AM PT, ~$30 of Claude API spend inside the product, public/synthetic data only, FalkorDB must be load-bearing, no published rubric.

---

## 1. Past winners and judge patterns

### Sources
- FalkorDB recap, Memory Meets Motion (SF, Aug 3 2026, 8 h): https://www.falkordb.com/blog/memory-meets-motion-the-falkordb-standouts/ (mirror: https://www.plushcap.com/content/falkordb/blog/falkordb-memory-meets-motion-the-falkordb-standouts)
- FalkorDB recap, Hack for Humanity 2026: https://www.falkordb.com/blog/how-builders-at-hack-for-humanity-used-falkordb-to-solve-real-community-problems/
- WeMakeDevs First Commit recap (Oct 7 2026): https://www.wemakedevs.org/blogs/first-commit-hackathon-recap-and-whats-next
- WeMakeDevs Zero Downtime winner write-up (Scraper Factory): https://dev.to/nitish_mane_2c399ba312e53/i-built-scrapers-that-heal-themselves-and-won-an-nvidia-dgx-spark-k13
- Event page / tracks: https://www.wemakedevs.org/hackathons/falkordb · resources: https://www.wemakedevs.org/hackathons/falkordb/resources
- No judge names, no rubric, no judge quotes exist anywhere public. Everything below is inferred from what FalkorDB's own writers chose to praise.

### What FalkorDB's writers rewarded (Memory Meets Motion)
| Project | Place | What the graph held | What was praised (near-verbatim) |
|---|---|---|---|
| Atrium | 1st overall | Each *wrong mental model* is a node; students link to the misconceptions they hold | "Its cleverest move is graph-native": a two-hop Cypher traversal "that a flat table or a vector search simply cannot express" |
| Hopper: Security Notification Triage | standout | Advisory → package → dependency → repo → service → customer → contract clause | Path traversal <100 ms; treats "no path found as a real proof of safety rather than an empty result"; vector search deliberately skipped |
| AgentCourt Precedent | standout | Prior rulings as precedent | "A deterministic Bailiff, not an LLM, has final authority" |
| MuscleMemory | standout | Failures, corrections, lessons across sim runs | "FalkorDB is what makes that experience compound" |
| Hopper: Adaptive Distribution | standout | Each negotiated decision written back as precedent | Future disruptions benefit "from precedent instead of starting cold" |
| Drift | standout | Every meeting decision as graph data; contradiction detection | "Built solo in an afternoon"; "decisions change in meetings, but GitHub issues do not know that" |
| Smart Home Orchestrator | standout | Room → occupants → history between them | Relationship "awkward to model outside a graph database" |
| DealBench | standout | Memory service | Live run "fails loudly rather than quietly falling back to canned dialogue" |

### What they rewarded (Hack for Humanity)
| Project | What the graph held | Praise |
|---|---|---|
| Board of SuperVision | 66 SF Board of Supervisors meetings → 7,553 nodes, 6,961 VOTED edges with a `vote` property, full-text index, `ro_query` + 3 s timeout + write-keyword regex + LIMIT 100 | "traversals over the record, not guesses from similar-looking text"; "the mark of someone who has shipped things before, building under a clock" |
| Can I park here? (Best Use of Photon) | 22,500 curb segments, 37,700 sweep schedules; `point` radius search + `collect()` | "a radius search and a join in one pass"; a README comment "I want to put in our docs"; idempotent `UNWIND … MERGE` batches, graph named by data hash, flagged ready only after import |
| LOCAL GACHA | Spot → Area / Experience two-hop | Gemini writes text but "cannot execute Cypher" — "the instinct is exactly right, and it scales" |

Cross-cutting lesson the author wrote out: raw input → LLM extracts typed facts → `MERGE` → read-only, time-limited queries traverse → every answer returns *evidence* (video timestamp, sweep schedule, a "why"). Separate suggesting (LLM) from deciding (graph).

### What WeMakeDevs rewarded (non-graph hackathons, same organiser)
- First Commit 1st: Suraksha, "the only one of the three winners built for somebody who is not the user". 2nd: Beacon Night Shift, a solo on-call agent that "finds the change that caused the problem, proposes one allowlisted fix, dry-runs it, and waits for approval" and improves after approval. 1,180 projects over four days.
- Zero Downtime 1st: Scraper Factory; the demo was a deliberately injected fault, a proposed repair *rejected by a deterministic verifier*, and the trace proving it.

### The pattern (what to design for)
1. **One graph-native clever move.** Model as a node something everyone else models as a score, a tag or a column (misconceptions, decisions, precedents, dependencies). The recap writers hunt for the sentence "a flat table or vector search cannot express this".
2. **Absence as evidence.** "No path = provably safe/unaffected" was singled out. Make a negative result a first-class answer.
3. **Precedent compounds.** Later runs must be visibly better because earlier runs wrote back to the graph.
4. **LLM proposes, graph decides.** Read-only queries, timeouts, deterministic gates, human approval before an action. The LLM never holds the Cypher pen in the praised projects.
5. **Evidence on every answer.** Timestamp, source quote, path. Judges want to "show the path behind an answer".
6. **Real public data with numbers in the README.** Recaps quote node/edge counts. Scale is a credibility signal; 5-venue toy graphs got no praise.
7. **Ship under a clock.** Idempotent imports, graph named by data hash, fail loudly, no canned fallbacks. Solo + small scope + one clever move is a *compliment*, not a weakness.
8. **Act, with a gate.** Both WeMakeDevs winners were agents that act (fix, repair) behind a verifier/approval. Track 1 says "decide and act".
9. **The track examples are the clichés.** Fraud, security triage, codebase, incident "what breaks if this goes down" are literally the brief's examples. Expect hundreds of each.

---

## 2. Competition map (as of Oct 13, two days before start)

Method: `gh search repos "falkordb" --created ">=2026-09-25"` (46 repos) + `"graph hacks"` (20) + web. Nearly every repo is 0 stars, 1–14 commits, README-first; several explicitly say code starts Oct 15. Two are notably complete and set the quality bar.

| Niche | Count | Repos | Verdict |
|---|---|---|---|
| Incident response / blast radius / DevOps graph | 7+ | Contextops-ai, aegis-graph, unspool, meridian-graphhacks, blastradius, CodeGraph, Graphops_FalkorDB | **Saturated.** Avoid. |
| Generic agent memory (store/recall, "p50 ms") | 8 | graphmem, Mnemo, hippocampus, graph-hacks-2026 (ZeroCapital), howdycarter, phro-secretary, yo-urun/ai-assistant, agent-memory-bench | **Saturated** and shallow (no LLM in several). Only a sharp twist survives. |
| Company brain (Slack/GitHub/meetings/decisions) | 7 | cortex, atlas (Slack), axon-brain (decision conflicts), Hydra "Minutes" (meetings), dealership-brain, NodeOps (OSS triage), precedent (decision graph for coding agents) | **Crowded.** Two of them (axon, precedent) already do "decisions with `invalid_at`, SUPERSEDES, warn when work conflicts". |
| Security / cyber triage | 5 | CyberGraph-AI ×2, rum1887/test "Trust Analyst", auditgraph, hybridRagFalkor | Crowded; Trust Analyst is strong (26 labels, temporal `valid_from/valid_to`, `$at` queries, ablation, benchmark). |
| Fraud / AML | 1 so far | Financial_Crime_Agent | Named in the brief → expect a late flood. |
| Novel niches | 1 each | Unheeded (NTSB open safety warnings at time of crash, empty repo), ripplekg (SEC 10-K supply-chain shocks + event study, early), Waaris (estate access paths), contrigraph (OSS contribution discovery) | Interesting but all early. |
| Our niches (checked Oct 13) | 0 | IETF/RFC, MCP tool graph, flight reroute, sanctions/ownership, legal citation, drug interaction, package-level CVE reachability | **Empty.** |

Quality bar set by the best two:
- **MERIDIAN** (aniruddhaadak80): 19 labels / 24 edge types, synthetic "Northwind Robotics", 4 agents, MCP endpoint, Vercel console with in-memory fallback, "proof bundle" + Cypher export judge endpoints, 60-second judge script, *ablation: 8/8 capabilities fail with relationships removed*, 24 unit tests. Weakness: benchmarks from the in-memory mirror, not FalkorDB; video placeholder.
- **Trust Analyst**: 14 matched benign/malicious pairs incl. prompt-injection variants, 8 named Cypher queries (blast radius, temporal path diff, choke-point convergence, simulated containment…), `make demo` 3-minute offline run, benchmark table vs. no-graph ablation.

Implication: a README with the graph model, the named Cypher/algorithms, an ablation ("remove FalkorDB → these N things break"), a 60-second judge path and deterministic demo data is now table stakes, not a differentiator. The differentiator is the idea + the dataset + the one clever graph move.

Also worth knowing: a dev.to post (dealership-brain) is already live with an "in-memory fallback for serverless" — judges reading "fallback when FalkorDB is unset" will treat the graph as decoration. Don't ship one.

---

## 3. FalkorDB edges to exploit (verified on docs.falkordb.com unless noted)

| Capability | Verified detail | Why most entrants won't use it |
|---|---|---|
| **Constrained shortest paths** `algo.SPpaths` / `algo.SSpaths` | Params: `sourceNode, targetNode, relTypes, weightProp, costProp, maxCost, maxLen, relDirection, pathCount` (0 = all shortest). Yields `path, pathWeight, pathCost`. Minimises one property while capping a *second* one. https://docs.falkordb.com/algorithms/sppath.html | It's a bi-criteria path search in one call (e.g. fastest route under a layover budget; cheapest chain under N hops). Nobody in the repo scan mentions it. |
| **MaxFlow / min-cut** `algo.maxFlow({sourceNodes, targetNodes, relationshipTypes, capacityProperty, nodeLabels})` → `nodes, edges, edgeFlows, maxFlow` | https://docs.falkordb.com/algorithms/maxflow.html | With unit capacities, max-flow = min-cut = "smallest set of edges/nodes whose removal disconnects A from B". Nobody will use it; it is a perfect "hero algorithm". |
| Centrality + communities | `algo.pageRank(label, relType)`, `algo.betweenness(config)`, `algo.WCC(config)`, `algo.labelPropagation(config)` (CDLP), `algo.BFS(source, maxLevel, relType)`, `algo.MSF`. https://docs.falkordb.com/cypher/procedures.html | Everyone will name-drop PageRank. Betweenness ("chokepoints") and WCC ("disputed clusters", "islands") are the under-used ones. |
| **Vector + full-text in one Cypher** | `CREATE VECTOR INDEX FOR (n:L) ON (n.p) OPTIONS {dimension, similarityFunction:'cosine'}`; `db.idx.vector.queryNodes(label, attr, k, vecf32([...]))`; `db.idx.fulltext.createNodeIndex` + `db.idx.fulltext.queryNodes(label, text)` (RediSearch: stemming, phonetic, TF-IDF). Hybrid via `CALL { … UNION … }` (LangChain's falkordb_vector does exactly this). Vector indexes also exist on **relationships** (`db.idx.vector.queryRelationships`). | Hybrid retrieval that then *continues into a traversal* in the same statement is the GraphRAG story FalkorDB wants told. Embedding edges (e.g. a decision's rationale) is rare. |
| **JS user-defined functions + FLEX** | `GRAPH.UDF LOAD`; `falkor.register()`; UDFs can read nodes/edges, `getNeighbors()`, custom DFS; read-only. FLEX ships `sim.jaccard`, `text.levenshtein`, `text.jaroWinkler`, `date.truncate/format/parse`, `coll.*`, `json.*`. https://docs.falkordb.com/udfs/ · https://www.falkordb.com/blog/falkordb-udfs-javascript-graph-extension/ | A custom in-database scoring function (e.g. ownership-% product along a path, time-decayed trust) is a strong "we extended the engine" talking point. Also FalkorDB has **no native date type** (only `timestamp()`), so `flex.date` matters. |
| **Multi-graph tenancy** | 10,000+ graphs per instance; each query targets one graph; no cross-graph queries. https://www.falkordb.com/news-updates/multigraph-topology-isolation-linear-scale/ | One graph per user/agent/tenant is a Track 2 bullet. Design around the no-cross-graph rule (shared graph + per-tenant graphs). |
| **GRAPH.COPY** | `GRAPH.COPY src dest` = point-in-time snapshot incl. indexes/constraints; source stays writable. https://docs.falkordb.com/commands/graph.copy.html | Fork-a-memory / what-if branch / rollback. Nobody is using it. |
| **Read-only guardrail** | `GRAPH.RO_QUERY` + `TIMEOUT`; the MCP server exposes `query_graph_readonly`. https://docs.falkordb.com/genai-tools/mcpserver | The praised pattern "LLM cannot execute writes" is one flag away. |
| **Graphiti on FalkorDB** | `pip install graphiti-core[falkordb]`, `falkor://` URI; bi-temporal edges (`valid_at` / `invalid_at`), invalidation not overwrite; hybrid BM25+vector+traversal retrieval. https://docs.falkordb.com/agentic-memory/graphiti.html | Fast path to bi-temporal memory, but LLM-at-write cost eats the $30 budget. Use for a small episode count or hand-roll the two timestamps. |
| **GraphRAG-SDK** | 0.8.x; ontology auto-detect, KG agents + orchestrator (one KG per agent). https://github.com/FalkorDB/GraphRAG-SDK | Adequate for "chat with docs", which is the cliché. Use only if the ontology step is itself the demo. |
| **@falkordb/canvas** | npm web component `<falkordb-canvas>`; `setData({nodes, links})`; force/tree/radial; dark mode. https://docs.falkordb.com/browser/canvas | Free, on-brand graph viz for the 2-minute video; judges recognise it. |
| Speed | GraphBLAS sparse-matrix traversal; FalkorDB-run multi-graph benchmark 25k→120k QPS. Independent reviews say "direction confirmed, multiple not". | Quote your own measured latencies (Hopper's "<100 ms" was praised); don't repeat vendor multiples. |

Gotchas to design around: no date type; `exists((n)-[]->())` unsupported (use pattern predicates); vector queries "don't combine well with property filters" (filter after the CALL); `shortestPath()` can't take property filters; FalkorDB Cloud free tier auto-stops when idle (self-host for judging).

---

## 4. Datasets that make a graph-shaped demo a judge can feel

All verified reachable Oct 13 unless marked.

| Dataset | Access | Native graph shape | Track fit |
|---|---|---|---|
| **IETF Datatracker API** | `https://datatracker.ietf.org/api/v1/doc/relateddocument/?relationship__slug=obs` (1,543 OBSOLETES edges; also `updates`, `replaces`), `doc/document/`, `doc/documentauthor/` (author + affiliation + order), `group/group/`. No key. rfc-index.xml for bulk. Mailing-list archive public at mailarchive.ietf.org. | Documents that supersede each other, authored by people in working groups in areas, over decades. | 3 (company brain), 1 |
| **Python PEPs** | `https://peps.python.org/api/peps.json` (fields incl. `superseded_by`, `replaces`, `requires`, authors, status, created); python/steering-council GitHub repo has accept/reject decisions; discuss.python.org threads. | Decisions with rationale, supersession, authority (Steering Council). | 3 |
| **deps.dev API + OSV** | deps.dev free, no key, computed transitive graphs for npm/PyPI/Go/Maven/Cargo (https://docs.deps.dev). OSV bulk: `https://osv-vulnerabilities.storage.googleapis.com/npm/all.zip`, `PyPI/all.zip`, with affected version ranges. | Package → version → depends-on → version; advisory → affects → version range. | 1 |
| **OpenFlights** | https://openflights.org/data (ODbL): 67,663 routes, 3,321 airports, 548 airlines (2014 structural snapshot). BTS on-time data for delay weights. | Airports and directed routes with distance; hubs = betweenness. | 1 |
| **OpenSanctions + Open Ownership register** | OpenSanctions bulk FollowTheMoney JSON/CSV, free non-commercial (https://www.opensanctions.org/docs/bulk/); Open Ownership BODS full download, attribution licence (https://register.openownership.org/download), UK/DK/SK/AM/UA. | Person/Company with Ownership statements carrying % and dates; sanctions designations. | 1 |
| **CourtListener** | v4 `opinions-cited` citation graph + bulk CSV; **API token required** (free account) and no treatment flags (overruled) in data. | Citation DAG, judges, courts. | 1/3, but weaker: treatment must be inferred. |
| **Synthea + DDInter 2.0** | Synthea pre-generated FHIR (public domain, https://synthea.mitre.org/downloads); DDInter 2.0: 2,310 drugs, 302,516 interactions with Major/Moderate/Minor (https://ddinter2.scbdd.com, DrugBank IDs → needs RxNorm crosswalk). | Patient → medication → ingredient ↔ interaction. | 1 |
| **Legislation (Legistar / SF Board)** | Many cities expose Legistar web APIs without keys; proven at Hack for Humanity. | Bills → sponsors → votes → committees; amends/repeals chains. | 3 |
| **Official MCP registry** | `https://registry.modelcontextprotocol.io/v0/servers` (server metadata only; tool schemas require connecting to each server's `tools/list`). | Servers → tools → typed params. | 1/2 (needs own scrape of ~40 public servers) |
| Enron corpus | Public but **contains living people's mail**; rules say no personal data. | Avoid. | — |

---

## 5. Agent-era pains (2026) that a graph uniquely solves

Sourced from: MAST taxonomy (1,600+ traces; inter-agent misalignment 36.9% of failures), LatticeMind arXiv 2608.08236 ("no trace of which claim won, which was contested, or why"), "Always-On Agents" survey arXiv 2606.30306 (failure modes: unauthorized leakage, stale propagation, contradiction persistence, provenance collapse), Mem0 state-of-memory 2026 (hardest open problems: cross-session identity, temporal abstraction, memory staleness; contradiction resolution weakest on BEAM), MCP tool-sprawl measurements (three servers = ~143k of 200k tokens in schemas; tool-selection accuracy 43% → <14% as catalog grows; Harness cut 130 tools → 11), Snyk ToxicSkills (13.4% of 3,984 agent skills critically flawed).

1. **"Which fact is currently true?"** Stores stack old and new facts; agents answer with the famous stale one. Needs supersession/validity edges and time-travel queries, not similarity.
2. **Disagreement with no ledger.** Multi-agent aggregation (vote, debate) erases who claimed what and on what evidence. Needs claims as nodes, SUPPORTS/CONTRADICTS edges, provenance paths.
3. **Tool sprawl.** 600 tools can't live in the context window; selection accuracy collapses. Needs typed tool graph + path planning + procedural memory of chains that worked.
4. **Provenance collapse across handoffs.** Agent B treats Agent A's output as ground truth. Needs every derived fact to carry a path back to a source node.
5. **Reachability questions with a safe negative.** "Is my service exposed to CVE-X?" / "Does supplier Y route to a sanctioned owner?" / "Is RFC 2616 still the rule?" The valuable answer is often *no path*, which vectors can't assert.
6. **Blast radius before action.** Agents that act need to know what else a change touches, with a gate.
7. **Per-tenant memory with isolation + concurrency.** Shared memory "surfaces the wrong agent's context half the time" by six agents.

---

## 6. The 8 ideas

Win-chance framing: ~3,000 registrants; WeMakeDevs' last 4-day event drew 1,180 submissions. Assume 400–800 real submissions, 3 track prizes, maybe 100–250 per track. A polished, deployed, graph-native entry with a dataset judges haven't seen is probably in the top 10–20 of a track; the prize is then a coin-flip on taste. Percentages below are for *winning that track's prize* given solid execution; top-50 (t-shirt) is likely for any of them.

### Idea 1 — Standards Brain: "Is this still the rule?" (Track 3 primary, Track 1 secondary)
- **Pitch:** A company brain for the IETF: 9,000+ RFCs, drafts, authors, working groups and mailing-list decisions in one graph, so an agent answers "what is the *current* rule on X, who decided it, who knows it, and which of my docs still cite the obsolete one" with the supersession path as evidence.
- **Graph model:** `(:Document {rfc, title, status, published})`, `(:Draft)`, `(:Person)`, `(:Group {wg})`, `(:Area)`, `(:Section)` chunks with embeddings, `(:Thread)` (mail-archive URLs). Edges: `OBSOLETES`, `UPDATES`, `REPLACES` (draft→RFC), `AUTHORED {order, affiliation}`, `IN_GROUP`, `IN_AREA`, `CITES` (from RFC references), `DISCUSSED_IN`, `HAS_SECTION`.
- **Hero traversal:** `MATCH p=(old:Document)<-[:OBSOLETES|UPDATES*1..]-(cur) WHERE NOT (cur)<-[:OBSOLETES]-() RETURN p` to compute *current truth* from any starting point; PageRank over `CITES` for authority; two-hop `(:Person)-[:AUTHORED]->(:Document)-[:IN_GROUP]->(g)` for "who knows QUIC"; hybrid vector+fulltext on sections, then *continue* into the supersession chain so retrieval never returns a dead RFC. Why not SQL/vectors: vector RAG returns RFC 2616 (most cited, most embedded) for HTTP questions; the correct answer requires following a variable-length chain whose end condition is "no incoming OBSOLETES", which is a graph predicate.
- **Aha moment (demo):** Split screen. Left: plain RAG cites RFC 2616 for "how should HTTP handle X". Right: the agent says "2616 is obsolete → 7230–7235 → 9110/9111/9112; current text is 9110 §9.3.1; authored by Fielding (Adobe), Nottingham, Reschke in HTTPbis; decided in thread …" with the path drawn in `@falkordb/canvas`. Then the *action* (Track 1): point it at a public repo/doc set; it opens a report listing every reference to an obsoleted RFC with the replacement, and a "provably current" badge where no OBSOLETES path exists.
- **Dataset:** IETF Datatracker API (verified: `relateddocument` 1,543 `obs` edges, `documentauthor` with affiliation, groups), rfc-index.xml, mailarchive.ietf.org. Zero LLM cost at ingest; LLM only for the final answer + extraction of a few hundred decision threads.
- **Crowding:** none found. Judges have never seen this dataset in a FalkorDB recap.
- **Feasibility (4 days):** High. Day 1 ingest + model, Day 2 queries + agent, Day 3 UI + action + deploy, Day 4 video/blog. Risk: "is the IETF a company?" → frame as "the org that invented versioned decisions"; add a 20-line adapter showing PEPs ingest into the same model to prove generality.
- **Win chance:** ~10–15% for Track 3 (highest on this list). Hits every Track 3 bullet literally ("keeping knowledge current", "tracing decisions to their source", "who knows what", "answers with clear sources") with a fresh, large, real dataset and a negative-result story.

### Idea 2 — Patch Path: provable CVE reachability + minimum upgrade cut (Track 1)
- **Pitch:** Given a fleet of (synthetic) services and their real transitive dependency graphs, the agent tells you which services are *actually* reachable by a new CVE, proves which are not, and computes the smallest set of version bumps that severs every path, then drafts the upgrade plan behind an approval gate.
- **Graph model:** `(:Package)`, `(:Version)`, `(:Service)`, `(:Advisory)`, `(:Team)`. Edges: `HAS_VERSION`, `DEPENDS_ON {range, direct}`, `AFFECTS {introduced, fixed}`, `DEPLOYS`, `OWNS`, `FIXED_BY`.
- **Hero algorithms:** `algo.BFS`/variable-length `DEPENDS_ON*` from each service to affected versions; **`algo.maxFlow`** with unit capacities on the service→advisory subgraph = min-cut = fewest packages to bump; `algo.betweenness` to show the "transitive chokepoint" packages. Why not SQL/vectors: recursive reachability across 5–10 hop dependency chains plus a min-cut is a graph problem; SQL recursive CTEs can't do min-cut and vectors are irrelevant.
- **Aha moment:** Paste an OSV ID. 40 services light up red/green in under a second; agent: "17 exposure paths through 2 chokepoints; bump `foo@1.4.2` and `bar@3.0.1` and all paths close; services A, B, C are provably unaffected (no path)". Approve → it writes the plan as `Decision` nodes that future advisories consult (precedent compounds).
- **Dataset:** deps.dev API (free, no key) for ~40 popular npm/PyPI roots; OSV `npm/all.zip` + `PyPI/all.zip`. Synthetic "company" with 40 services pinned to real manifests.
- **Crowding:** Low-moderate. Hopper did advisory→customer at Memory Meets Motion and was praised, so the *shape* is validated; current entrants' "blast radius" repos are code/incident level, not package level, and none use max-flow.
- **Feasibility:** High. Data is JSON, no LLM at ingest, cheap on budget.
- **Win chance:** ~8–12% for Track 1. Strong "act with a gate" story; risk is that security triage is a named cliché, so the min-cut + proof-of-safety must carry the pitch.

### Idea 3 — Reroute: disruption agent for the world air network (Track 1)
- **Pitch:** Close an airport or ground an airline; the agent re-plans thousands of itineraries under a layover budget, explains each choice, and flags passengers it cannot save.
- **Graph model:** `(:Airport {iata, lat, lon, country})`, `(:Airline)`, `(:Itinerary)`, `(:Passenger)` (synthetic). Edges: `ROUTE {airline, distance, duration, delay_p50}` (from OpenFlights + BTS), `BOOKED_ON`, `OPERATES`, `CLOSED {from, to}` events.
- **Hero algorithms:** **`algo.SPpaths`** with `weightProp: duration, costProp: hops/layover_minutes, maxCost`, `pathCount: 3` (bi-criteria in one call); `algo.betweenness` to show hub chokepoints before the closure; `algo.maxFlow` on seat capacity to answer "how many pax/day can still move Europe→Asia with DXB closed". Why not SQL/vectors: constrained k-shortest paths and flow are graph algorithms; SQL can't express the second constraint cheaply.
- **Aha moment:** World map; click "close DXB"; 1,200 itineraries re-colour as they reroute; one card shows "pax 4471: DXB closed → via DOH, +2h10, 1 extra hop, under 4 h layover cap"; a red list of 38 unsaveable itineraries with the reason (no path under constraints).
- **Dataset:** OpenFlights (ODbL; 2014 structural snapshot, label it so), BTS on-time for delay weights, synthetic passengers.
- **Crowding:** None found.
- **Feasibility:** Medium-high. Map UI costs a day; algorithms are built in.
- **Win chance:** ~6–9%. Most *visceral* demo on the list, but least "agent-era"; judges may read it as classic graph routing with a chat wrapper. Lift it with memory (prior disruptions as precedent) or skip.

### Idea 4 — Chain of Title: effective sanctions exposure through ownership (Track 1)
- **Pitch:** For any company, compute whether it routes to a sanctioned person through ownership chains, the *effective* ownership percentage along each chain, and whether that was true on a given date; then act (block/flag supplier) behind a human gate.
- **Graph model:** `(:Person)`, `(:Company)`, `(:Sanction {program, listed_at})`. Edges: `OWNS {pct, valid_from, valid_to, source}`, `CONTROLS`, `SANCTIONED_BY`, `SAME_AS` (OpenSanctions dedup).
- **Hero traversal:** variable-length `OWNS*1..6` with a **JS UDF** that multiplies `pct` along the path and applies the as-of date filter in-engine; `algo.WCC` to surface ownership islands; `algo.SPpaths` with `costProp: hops`. Why not SQL/vectors: recursive weighted product with temporal validity over millions of edges.
- **Aha moment:** Type a UK company; 4-hop chain appears: 51% → 60% → 100% → listed person = 30.6% effective; slider moves the as-of date and the chain breaks when a 2023 transfer invalidates an edge.
- **Dataset:** OpenSanctions (non-commercial bulk) + Open Ownership BODS (UK PSC etc.).
- **Crowding:** Moderate: "fraud" is the first example in the brief and one AML entrant exists. The twist (effective %, temporal validity, real registers) is distinct, but judges will see many ring-detection demos.
- **Feasibility:** Medium. BODS wrangling and entity resolution can eat two days; subset to one jurisdiction.
- **Win chance:** ~5–8%. Good graph story, crowded neighbourhood.

### Idea 5 — Dissent Ledger: contradiction-aware shared memory for agent teams (Track 2)
- **Pitch:** A shared memory where every claim is a node with provenance and validity, agents must record disagreements as edges instead of overwriting, and any agent can ask "what do we currently believe, who disputes it, and what did we believe at time T?"
- **Graph model:** `(:Claim {text, embedding, valid_at, invalid_at})`, `(:Agent)`, `(:Source)`, `(:Task)`, `(:Tenant)` (one graph per tenant). Edges: `ASSERTED {t, confidence}`, `SUPPORTS`, `CONTRADICTS {t}`, `SUPERSEDES`, `DERIVED_FROM`, `CITES`.
- **Hero algorithms:** `algo.WCC` restricted to `CONTRADICTS` edges → disputed clusters surfaced to a human; variable-length `DERIVED_FROM*` to trace any answer to raw sources (provenance collapse fix); time-travel predicate `valid_at <= $t < coalesce(invalid_at, inf)`; hybrid vector+fulltext to find near-duplicate claims before writing (dedup is itself a graph write guard). Why not SQL/vectors: vectors return both the old and new fact with similar scores; the "which is current and who disputes it" answer is edge structure.
- **Aha moment:** Three research agents summarise a public, changing corpus (e.g. PEP threads or RFC drafts). Agent 2 writes a claim contradicting Agent 1; the ledger refuses to overwrite, draws the CONTRADICTS edge, and a fourth "arbiter" agent resolves it with a cited source; scrub the time slider to see belief at any point. Then an ablation: same run with a flat key-value memory → silent overwrite.
- **Dataset:** Synthetic multi-agent traces over public text (PEPs/RFCs/Wikipedia revision history).
- **Crowding:** Memory is the most crowded track (8 generic repos), but none model disagreement. The pain is well-cited (LatticeMind, MAST).
- **Feasibility:** High, if the multi-agent scenario is scripted/deterministic (cheap on budget).
- **Win chance:** ~7–10% for Track 2. Differentiated on *the* 2026 research pain; risk is judges lumping it with memory stores unless the contradiction demo is first and loud.

### Idea 6 — Branching Memory: fork, explore, diff, merge with GRAPH.COPY (Track 2)
- **Pitch:** Git for agent memory. An agent forks the tenant's memory graph before a risky plan, explores in isolation, and the coordinator diffs and merges (or drops) the branch; handoffs are branch pointers, rollbacks are `GRAPH.DELETE`.
- **Graph model:** Memory graph per tenant; `GRAPH.COPY tenant:main tenant:branch-x`; a tiny `(:Branch {parent, created_by, status})` registry graph. Inside: episodic `(:Event)`, semantic `(:Fact)`, procedural `(:Procedure)` nodes.
- **Hero mechanics:** `GRAPH.COPY` point-in-time snapshot (unique to FalkorDB among the obvious choices); diff = `MATCH` on content hashes across the two graphs via the client (no cross-graph Cypher, so diff in the app and store the delta as a `(:Merge)` node with `ADDED/REMOVED/CONFLICT` edges); `algo.WCC` on conflicts. High-concurrency reads/writes bullet: branches never contend.
- **Aha moment:** Two agents branch from the same memory, pursue opposite hypotheses, merge shows 3 conflicts and 40 clean additions; one click discards a branch and memory is byte-identical to before.
- **Dataset:** Synthetic.
- **Crowding:** None. Nobody is touching GRAPH.COPY.
- **Feasibility:** Medium. Merge semantics are a rabbit hole; cap at union + conflict list.
- **Win chance:** ~5–8%. Novel and clearly FalkorDB-dependent, but judges may ask "why not versioned nodes in one graph?"; have the isolation/concurrency answer ready.

### Idea 7 — Tool Atlas: typed tool graph that replaces 600 schemas in context (Track 1 "tool selection via MCP" + Track 2 procedural memory)
- **Pitch:** Load every public MCP server's tools into a typed graph; the agent plans a tool chain as a path over types, loads only the 3–4 schemas it needs, and stores chains that worked as procedures, so the second time costs one hop.
- **Graph model:** `(:Server)`, `(:Tool {name, schema_hash, embedding})`, `(:Type)` (normalised JSON-schema shapes: `url`, `path`, `issue_id`, `dataframe`…), `(:Procedure)`, `(:Run)`, `(:Tenant)`. Edges: `EXPOSES`, `CONSUMES`, `PRODUCES`, `CO_USED {count}`, `STEP {order}`, `SUCCEEDED/FAILED`, `ALLOWED_FOR` (tenant permissions as edges).
- **Hero algorithms:** `algo.SPpaths` over `CONSUMES/PRODUCES` from the types you have to the type you need (`maxLen` = chain budget); `algo.pageRank` on `CO_USED` for tool reputation; hybrid vector+fulltext on tool descriptions *then* restrict to reachable, permitted tools in the same query; precedent lookup `(:Procedure)-[:STEP*]->(:Tool)` before planning. Why not SQL/vectors: vector top-k returns 10 similar tools, none of which compose; composition is a path over typed edges.
- **Aha moment:** Counter at top: "Tools in catalog: 612. Schemas in context: 3. Plan found in 1.8 ms: fetch → extract_table → create_issue." Rerun the same task tomorrow → "reused Procedure #14 (succeeded 3/3)". Ablation: same task with all schemas in context → 143k tokens and a wrong tool pick.
- **Dataset:** Official MCP registry (server metadata) + own `tools/list` scrape of ~40 public servers (official reference servers, Playwright, GitHub, fetch, sqlite, etc.); no logins needed for listing.
- **Crowding:** None in the entrant scan; prior art is a Neo4j research README ("Unified-MCP-Tool-Graph") — cite and go further (path planning + procedural memory).
- **Feasibility:** Medium. The scrape is the risk (servers that refuse to start without env vars); mitigate by vendoring ~20 schemas and generating a synthetic long tail.
- **Win chance:** ~8–12% for Track 1 (it is literally a track bullet) and decent for Track 2. Strongest "agent-era pain" narrative; weakest "feel it" demo unless the counter/ablation is dramatised.

### Idea 8 — Decision Brain for a real open organisation: Python PEPs + Steering Council (Track 3)
- **Pitch:** The same "is this still the rule / who decided / who knows" brain as Idea 1, but over Python's PEPs, Steering Council decisions and discuss.python.org threads, where the *rationale* and *rejected alternatives* are richer and more human.
- **Graph model:** `(:PEP {status, type})`, `(:Person)`, `(:Decision {verdict, date})`, `(:Thread)`, `(:Alternative)`. Edges: `SUPERSEDED_BY`, `REPLACES`, `REQUIRES`, `AUTHORED`, `SPONSORED`, `DECIDED_BY`, `REJECTED_IN_FAVOUR_OF`, `DISCUSSED_IN`.
- **Hero traversal:** supersession chain to current; `REQUIRES*` closure ("what must be understood before PEP 695"); `algo.labelPropagation` on co-authorship/discussion to find knowledge communities (typing, packaging, interpreters); LLM extracts rejected alternatives from PEP text into `(:Alternative)` nodes (the Atrium move: model the *rejected idea* as a node).
- **Aha moment:** "Why doesn't Python have X?" → graph answers with the PEP that rejected it, the decision record, the thread, and the person to ask today.
- **Dataset:** peps.json (has `superseded_by`, `replaces`, `requires`), python/steering-council repo, Discourse JSON.
- **Crowding:** None.
- **Feasibility:** High; LLM extraction of alternatives for ~600 PEPs is ~$3–5.
- **Win chance:** ~7–10%. Slightly behind Idea 1 because the supersession graph is smaller (hundreds of edges vs. thousands) and the "company" framing is a little looser; ahead on rationale richness. The two can share one codebase (adapter per source), which is the best hedge.

---

## 7. Top 3 and why

1. **Standards Brain (Idea 1, IETF; Track 3 + Track 1).** It matches every Track 3 bullet word-for-word, uses a large real dataset nobody else has, has a crisp negative-result story ("provably current"), needs almost no LLM spend, and is low-risk to build in four days because the API is already verified. The "RAG cites the obsolete RFC, the graph doesn't" split-screen is the single most judge-legible demo in this list. Ship the PEP adapter (Idea 8) as a second source if time allows; it answers "is this just RFCs?" in one slide.
2. **Patch Path (Idea 2; Track 1).** Validated shape (Hopper was praised for exactly advisory→service paths with "no path = safe"), plus two hero algorithms nobody else will touch (max-flow min-cut, betweenness chokepoints), plus an act-with-approval loop that WeMakeDevs winners share. Cheap data, cheap tokens. Its risk is sitting next to the "security triage" cliché, so lead with the min-cut.
3. **Tool Atlas (Idea 7; Track 1 + 2).** Best match to the 2026 pain FalkorDB's own audience cares about (tool sprawl numbers are brutal and citable), explicitly a track bullet ("tool selection via MCP"), and doubles as procedural memory. Ranked third only because the ingest has a real failure mode and the demo needs staging to be felt. If the owner wants a Track 2 entry instead, swap in **Dissent Ledger (Idea 5)**: same build cost, strongest research backing, and it is the only memory entry that isn't a store/recall clone.

Avoid: incident/blast-radius, generic memory, Slack/GitHub company brain, fraud rings, chat-with-docs. The scan shows 7–8 near-identical repos in each, and the brief's own examples will pull hundreds more.
