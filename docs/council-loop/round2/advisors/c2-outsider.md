# Outsider advisor: Candidate 2 (Kubernetes outdated-docs finder)

I'm reading this as a smart non-specialist judge seeing it for the first time. The one-line pitch is clear: "find Kubernetes doc pages that are wrong, prove why, and say who should fix them." Most outsiders can follow that. The hard part is the jargon behind it. A judge needs to know what feature gates, KEPs, SIGs and `apiVersion` are before the demo means anything. To the FalkorDB/WeMakeDevs audience that's familiar ground, but the first 15 seconds of the video have to make the stakes concrete for everyone else.

## SCORES (1–10)
- **Graph essential: 7.** The proof path (Page → Claim → Gate → Release → KEP → Issue) and the routing (KEP → SIG, Page ← PR ← Person) are real multi-hop joins over four sources, and the path is the product. The contradiction check on its own (claim stage vs. truth table) is a SQL join, though, so the graph earns its place mainly through the routing and the proof card.
- **Demo memorability: 6.** "Grep says 60, the graph keeps 31, with proof" plus a real upstream issue is concrete and believable. The most memorable shot, Claude Code catching a removed `apiVersion` by itself, is below the cut line and may never get built.
- **4-day feasibility: 6.** The core (truth layer, deterministic claims, exclusions, cards) is doable. People data from git history and the GitHub API, the backtest and the MCP guard add up to three more systems. The plan is honest about the cut line, which helps.
- **Originality: 7.** I found no tool that checks Kubernetes doc prose against feature-gate history. Pluto/kubent check manifests and clusters, not docs. Generic doc-drift tools exist, though, including a recent hackathon one.
- **Real-world usefulness: 6.** The real user is SIG Docs reviewers and contributors, an important but small group of volunteers. Developers benefit indirectly. Upstream issues filed during the event would turn "useful" from a claim into evidence.

## WIN CHANCE (Company Brain): ~8%
The fit to Company Brain is explicit: docs, tickets and people in one graph, "keeping knowledge current", answers with sources. Real public data, a measured baseline and upstream proof put it well above a typical "chat with your Notion" entry. Against it: it's a niche dev-tools story, and judges may read "company brain" as an internal-knowledge assistant. Both prizes are a single slot among perhaps 100–300 submissions.

## EVIDENCE
- No dedicated stale-feature-gate-docs linter turned up. Kubernetes keeps a separate removed-gates reference with per-release stage tables, so the ground truth exists and can be parsed ([removed gates](https://v1-36.docs.kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed/)).
- `feature_gate_name` pulls the stage dynamically, and `state` is a manual override. That confirms the gap the brief targets: badges without the parameter are hand-maintained ([Hugo shortcodes](https://kubernetes.io/docs/contribute/style/hugo-shortcodes)).
- Pluto detects deprecated or removed apiVersions in files and Helm charts, and kubent audits live clusters. Neither looks at docs prose ([Pluto](https://pluto.docs.fairwinds.com/), [Plural guide](https://www.plural.sh/blog/kubernetes-api-deprecation-tool-guide/)). A judge may ask "why not run Pluto on the YAML blocks?"
- Generic drift checkers exist: DriftGuard, an LLM docs-vs-code hackathon entry ([lablab](https://lablab.ai/submissions/hagwkuvoyv5zjmhne7eb4htr)), and Codocia, a coverage-hash drift checker for coding agents ([docs.rs](https://docs.rs/crate/codocia/latest)).
- Context7 already serves version-specific docs to coding agents ([Context7](https://trevorlasn.substack.com/p/context7-mcp-up-to-date-docs-for)), which makes `is_current` less novel.
- FalkorDB's MCP server runs OpenCypher (with a read-only mode) for agents, and FalkorDB supports only a subset of Cypher ([docs](https://docs.falkordb.com/genai-tools/mcpserver)).
- I found no published winners from the earlier FalkorDB/WeMakeDevs Graph Hacks ([event](https://www.wemakedevs.org/hackathons/falkordb)), so I can't calibrate against past winners.

## Simulation (short)
Day 1: parsing gate files and `kep.yaml` goes smoothly. Claim extraction from Markdown and shortcodes needs edge-case work. Day 2: the exclusions and the grep baseline land. Hand-labelling the precision sample takes hours. Day 3: git-history people data is noisy (bots, mass-rename PRs), and GitHub API rate limits slow things down. Day 4: polish and video, and the backtest most likely gets dropped. Skeptical judge questions: (1) Why a graph and not a SQL join? (2) Why not Pluto plus grep? (3) Who uses this after Saturday? (4) Did maintainers accept your issues? (5) How is a "sentence mentioning a gate" stale if Claude misclassifies it? Questions 2 and 4 are where the pitch breaks if it's unprepared.

## TOP 3 FLAWS
1. **The best moments are optional.** If the backtest and the agent guard are cut, the demo is a list of cards plus a fix list, which is competent but forgettable.
2. **Outsider comprehension.** A judge who doesn't know feature gates sees "beta vs removed in v1.33" and shrugs. Without a 10-second "why this hurts real users" opener, it's lost.
3. **The findings may be thin or noisy.** If real stale pages number around 10, or the filed issues get closed as "intentional/historical", the headline numbers fall apart live.

## THE BEST VERSION
Keep the truth layer, the proof card, the SIG fix list and the grep comparison. Start filing upstream issues on day 2 so maintainers have time to respond. Pull the `is_current` MCP guard *above* the people layer. It's cheap, it's the most memorable shot, and it secures the Track 1 entry. Cut the full backtest down to one release slice. Open the video with a real user harmed by a removed `apiVersion` copied from the docs.

## VERDICT
Build it with changes: it's clear, grounded and verifiable, but move the agent-guard shot inside the guaranteed scope and spend the first seconds making the stakes obvious to non-Kubernetes judges.
