# Candidate 4: Kubernetes docs freshness brain. Expansionist review

## SCORES (1–10)
- **Graph essential: 7.** Release → gate/API → claim → page → linked page is a real multi-hop dependency walk, and PageRank runs on the link graph. Remove FalkorDB and both propagation and the "why" paths go away. It isn't a 9 because the first hop (page mentions a removed gate) could be done with grep.
- **Demo memorability: 7.** A release "rippling" through the docs, ending on one highlighted sentence and the changelog line that made it wrong, is easy to grasp and visual. Nothing in it surprises like a live upstream PR would.
- **4-day feasibility for one builder: 6.** kep.yaml is structured (NodeSwap shows feature-gates, owning-sig and per-stage milestones), so ingestion is deterministic. The risks are the precision work, the ripple-canvas UI and hand-checking 30 pages, all in a demo-ready state inside 4 days.
- **Originality vs competitors: 7.** Doc-drift tools (Swimm, DeepDocs, Mintlify, DOCER, Codocia) all tie docs to *code*. None ties docs to *release semantics* (gate stage, API removal) with a graph proof chain. Calling it "truth maintenance" is a strong framing.
- **Real-world usefulness: 6.** The problem is real: website issue #46575 was a ServiceNodeExclusion gate still on a page years after removal. But Kubernetes already has a process that requires doc PRs when gates are removed, and the true users are a few SIG Docs maintainers.

## WIN CHANCE (Company Brain): about 8%
With 100–300 real entries spread over three tracks, perhaps 50–100 enter Company Brain. Most will be generic "Slack+Notion RAG" brains, and this stands out against them: real public data, a provable answer, a validated precision number. Two things hold it back. Kubernetes is not a company, and there are no tickets or chats, which is where the track examples point. Track 1 is a credible second entry.

## EVIDENCE
- Closest prior art is code-linked drift detection: DOCER [arXiv 2307.04291](https://arxiv.org/pdf/2307.04291), [Codocia](https://docs.rs/crate/codocia/latest), [Mintlify on drift](https://www.mintlify.com/library/how-to-stop-documentation-drift), [Swimm](https://devtoollab.com/ai-tools/swimm), [DeepDocs](https://alternativeto.net/software/deepdocs/about). There is also a lablab hackathon entry, [DriftGuard](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/team-said/driftguard-ai-doc-drift-detection-engine), so "doc drift" alone is not novel.
- Real stale K8s docs exist: [website #46575](https://github.com/kubernetes/website/issues/46575). Removal requires a website follow-up ([k/k #116255](https://github.com/kubernetes/kubernetes/issues/116255)). An official [removed gates page](https://v1-36.docs.kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed/) is the ground-truth list.
- kep.yaml structure confirmed: [NodeSwap kep.yaml](https://github.com/kubernetes/enhancements/blob/master/keps/sig-node/2400-node-swap/kep.yaml).
- FalkorDB has `CALL algo.pageRank(label, relType)` ([docs](https://docs.falkordb.com/algorithms/pagerank)) and an official [MCP server](https://docs.falkordb.com/genai-tools/mcpserver).
- No past winners published for WeMakeDevs/FalkorDB events ([event page](https://www.wemakedevs.org/hackathons/falkordb)), so judging can't be calibrated against them.

## SIMULATION
Day 1: ingest KEPs, the removed/deprecated lists and the website Markdown, then run the regex MENTIONS pass. Day 2: claim extraction, propagation Cypher and PageRank. Day 3: canvas, MCP tools, fixes. Day 4: hand-check, video, tunnel. **Breaks:** Day 2, when false positives swamp the results (blog posts, "this gate was removed in 1.27" history sentences, the feature-gates reference page itself). The demo shot that breaks is "open top page": if the top page is the removed-gates reference page, the whole story falls apart. Judge questions: (1) "Couldn't grep do this?" (2) "What was precision?" (3) "Why is Kubernetes a company brain?" (4) "Did upstream accept any fix?" (5) "What does an agent do with it?" Q3 and Q5 are weak today.

## STEELMAN / ATTACK
**For:** it uses real, verifiable, public data. It gives explainable paths, which judges explicitly asked for. It reports a measured precision, which is rare at hackathons. Upstream issues or PRs would be proof from outside. The cost of Claude calls is tiny. **Against:** the graph's value sits in the second and third hops, but most real hits come from the first. Few people outside SIG Docs would use it. The Company Brain fit is a stretch.

## TOP 3 FLAWS
1. **Precision collapse.** Historical and changelog-style sentences get flagged, and the hand-check comes out at 40%. The headline number then works against you.
2. **Track fit.** A judge asks "where are the tickets and owners' conversations?" and scores it below a Slack-style brain.
3. **The first hop is all that matters.** Link propagation adds noise, the low-confidence ripple is mostly wrong, and the "graph" story shrinks to regex plus a list.

## THE BEST VERSION (upside the brief misses)
- **Add GitHub issues and PRs as the "tickets and chats" layer.** Link KEPs to their tracking issues and website PRs (`(:PR)-[:FIXES]->(:Page)`, `(:Person)-[:REVIEWED]->`). Two things follow. Company Brain fit becomes literal, and "who should fix this?" becomes a graph answer (the person who last touched the page and the gate's SIG owner).
- **Turn the agent story around.** Coding agents routinely write manifests with removed APIs. Ship `is_current` as an MCP guard that a Claude Code agent calls before trusting a doc snippet, and show it catching a deprecated `apiVersion` live. That unlocks Track 1 properly.
- **Get outside proof before Saturday.** File 3–5 real website PRs on Day 2 and show their links (merged if lucky) in the video. Nothing else in the field will have that.
- **Cut:** blog and non-English content, the low-confidence link ripple (show it only as "at risk"), and drafted fixes beyond the top 5. **Keep:** proof paths, the PageRank SIG lists, the precision table.

## VERDICT
Build it with changes: the core is distinctive and provable, but to reach real winning odds it needs the issues/PRs layer, the agent-guard demo and upstream PRs filed early.
