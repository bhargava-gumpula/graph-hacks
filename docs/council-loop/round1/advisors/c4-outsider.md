# Candidate 4: Outsider review ("which Kubernetes docs went stale after a release, and why")

Perspective: a smart non-specialist judge seeing this for the first time.

## First impression (the outsider test)
The one-line pitch is clear: *"A new release came out. Here are the doc pages that are now wrong, each with the line from the release notes that proves it."* Anyone who has followed an outdated tutorial gets it in five seconds. Calling it a "truth-maintenance system" will mean nothing to most judges. It is a nice detail for the README but the wrong headline. The demo's ripple, where a removed feature lights up its claims and then its pages, is easy to picture and remember. The weak point is the audience. To a non-Kubernetes judge, "feature gate graduated to GA" is jargon, so the payoff ("this sentence is false") has to be shown on screen in plain English.

## SCORES (1–10)
- **Graph essential: 8.** Spotting stale docs is a multi-hop walk (Release→Gate→Claim→Page→linked Page) that also has to return the path as evidence. Without the graph you have grep and nothing to explain the result.
- **Demo memorability: 6.** The ripple plus a red-highlighted false sentence is a good shot, but it hits harder for people who already know Kubernetes. A generalist judge needs a narrator to explain it.
- **4-day feasibility: 6.** The core can be built: kep.yaml is clean structured data, and regex mentions are deterministic. But the brief stacks claim extraction, propagation, PageRank, SIG lists, drafted fixes, 3 MCP tools, a canvas and a hand-checked precision study. That is an over-full plate for one person.
- **Originality: 6.** Doc-drift tools already exist (Codocia, DriftGuard, CI diff-based Claude actions). All of them are code-diff to doc and none uses a release→entity→claim graph with proof paths. Still, the category is not new.
- **Real-world usefulness: 7.** The problem is real and recurring: Kubernetes needs a website PR for gate removals, and stale gate mentions still slip through (issue #46575). Who uses it: SIG Docs and release-team docs shadows, and by analogy any company with versioned docs.

## WIN CHANCE (Company Brain): ~9%
With perhaps 100–300 real submissions and most Company Brain entries likely to be "chat with your Slack/Notion" RAG, a project that gives verifiable answers on real public data and can show outside proof (an accepted upstream issue or PR) stands out. It loses if the demo turns into Kubernetes jargon, or if judges see it as a "docs linter" rather than a "brain". There is no published rubric, so I stay modest.

## EVIDENCE
- Prior art: Codocia ties Markdown pages to code-file hashes; [DriftGuard](https://lablab.ai/ai-hackathons/ibm-bob-hackathon/team-said/driftguard-ai-doc-drift-detection-engine) is an LLM-over-diff hackathon project; [CI drift detection with Claude Code](https://understandingdata.com/posts/doc-drift-detection-ci/); [ReadMe's approach](https://readme.com/resources/ai-writer-detecting-doc-drift). None of them traces staleness from a release through dependencies with proof paths.
- Real pain: [kubernetes/website#46575](https://github.com/kubernetes/website/issues/46575) shows a page still naming a gate gone since v1.23; [kubernetes#116255](https://github.com/kubernetes/kubernetes/issues/116255) shows a gate removal requires a matching website PR.
- Data is structured: the [sidecar KEP kep.yaml](https://raw.githubusercontent.com/kubernetes/enhancements/master/keps/sig-node/753-sidecar-containers/kep.yaml) has stage, milestones per release, feature-gates and owning-sig. Kubernetes also publishes a [removed feature gates page](https://v1-35.docs.kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed/), which gives a ready answer key.
- FalkorDB: [`algo.pageRank(label, relType)`](https://docs.falkordb.com/algorithms/pagerank.md) exists. The docs disagree on whether arguments can be null, so test it early. Only a subset of openCypher is supported (no APOC/GDS) ([procedures](https://docs.falkordb.com/cypher/procedures.html)).
- WeMakeDevs past winners are poorly documented ([Telegram](https://t.me/s/WeMakeDevs)). Judges praised "innovative use" of the sponsor's tech, so making FalkorDB central matters.
- Truth maintenance is classic AI ([TMS overview](https://cis.temple.edu/~giorgio/cis587/readings/tms.html)), a good credibility line for the README.

## Simulation (where it breaks)
Day 1: ingest KEPs, gates, releases and pages, plus regex mentions; this works. Day 2: claim extraction plus propagation; noise shows up (glossary and feature-gate reference pages mention every gate). Day 3: PageRank, SIG lists, MCP and the canvas; the UI eats the day. Day 4: hand-check 30 pages, video, deployment; the precision study gets squeezed. Questions a skeptical judge would ask: *Isn't this just grep for removed gate names?* (answer: the claim layer and the link propagation). *What is your precision?* *Why not run an LLM over the diff?* *Who acts on the output?* *Did upstream accept anything?* The first two break the pitch if precision is below about 60%.

## Steelman vs attack
FOR: real public data, a deterministic core, proof paths that judges can check, and outside validation. AGAINST: the audience is narrow, the domain is full of jargon, it could look like a linter, and the feature list over-promises for one builder.

## TOP 3 FLAWS
1. **Jargon demo.** A judge watches gates "graduate" and claims light up, but never understands why a sentence is wrong, so the video lands flat.
2. **False positives.** Reference pages and version-gated text (`{{< feature-state >}}` shortcodes, "since v1.29") get flagged as stale. A hand-check at around 40% precision becomes the headline.
3. **Scope sprawl.** Drafted fixes, MCP and the SIG views eat Day 4, and the validation number, the strongest proof, ships thin or not at all.

## THE BEST VERSION
Keep: release→gate→claim→page propagation with paths, the PageRank ranking, one MCP tool (`why_stale`), and the hand-checked precision. Cut: drafted fixes, `is_current` chat, and the multi-SIG UI (show one SIG). Add: a plain-English before/after card ("Docs say: beta. Truth: removed in v1.xx"), exclusion rules for reference pages, and **one actually filed upstream issue or PR** linked in the README. Lead with "outdated docs finder", not "truth maintenance".

## VERDICT
**Build it with changes:** the core is clear, graph-native and genuinely useful, but trim the scope and translate the demo for non-Kubernetes judges.
