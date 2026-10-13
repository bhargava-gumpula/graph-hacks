# Contrarian review: Candidate 2, Kubernetes outdated-docs finder

## SCORES (1–10)
- **Graph essential: 5.** The core detection is a lookup (claim text → gate or apiVersion → "removed/changed after date"). A Python dict plus `git log` does it. The graph only earns its place in the routing and proof-path layer, which is a fixed four-hop chain and not real traversal or algorithm work.
- **Demo memorability: 5.** Honest, careful and dry. "Page X says beta, truth says removed" is a spreadsheet row. The `is_current` agent moment is the only vivid shot, and it sits below the cut line.
- **4-day feasibility for one builder: 4.** It has six data layers (feature-gate files, kep.yaml, website prose with full git history, GitHub PRs/reviews, issues, OWNERS) plus a backtest, an MCP tool and upstream filings. The kep.yaml and feature-gate formats have changed over the years, and parsing them alone could eat day 1.
- **Originality vs competitors: 6.** Doc-drift tools exist (Staleguard, Codocia, Doc Drift Detector), and Pluto and kubent already catch removed apiVersions in manifests. Combining a release-truth graph with owner routing for k8s docs is new.
- **Real-world usefulness: 5.** The real users are a few dozen SIG Docs reviewers, and k8s already automates the badge case. The leftover space is narrower than the pitch implies.

## WIN CHANCE (Company Brain): ~5%
There is one prize among perhaps 100–300 submissions. The rigor (baseline, backtest, upstream issues) is above average. But Company Brain asks for "docs, tickets and chats… who knows what", and this is an OSS docs linter with no chats and no Q&A. Judges may see it as a stretch fit, and a polished "ask your company anything with sources" entry will read as more on-brief.

## EVIDENCE
- `feature-state` with `feature_gate_name` pulls the stage from the gate files, and older versioned docs are frozen snapshots, so "stale" pages there are expected and not bugs: [Hugo shortcodes](https://kubernetes.io/docs/contribute/style/hugo-shortcodes), [removed gates v1.35](https://v1-35.docs.kubernetes.io/docs/reference/command-line-tools-reference/feature-gates-removed/).
- Gate removals already trigger required follow-up website PRs, so the process catches the easy cases: [k/k #116255](https://github.com/kubernetes/kubernetes/issues/116255), [website #43518](https://github.com/kubernetes/website/pull/43518).
- Pluto already detects deprecated and removed apiVersions in files: [FairwindsOps/pluto](https://github.com/FairwindsOps/pluto), [docs](https://pluto.docs.fairwinds.com/).
- Doc-drift prior art, including a past hackathon entry: [DriftGuard](https://lablab.ai/submissions/hagwkuvoyv5zjmhne7eb4htr), [Staleguard](https://gitblind.noratr.app/Arthur920/Staleguard), [Codocia](https://docs.rs/crate/codocia/latest).
- The FalkorDB MCP server exists, but FalkorDB supports only a subset of OpenCypher, so Neo4j habits will not carry over: [MCP server docs](https://docs.falkordb.com/genai-tools/mcpserver).
- GitHub API allows 5,000 requests/hour when authenticated. Per-file commit→PR→reviewer lookups across thousands of pages will hit that limit: [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- No published winners from earlier FalkorDB/WeMakeDevs Graph Hacks, so we cannot calibrate what wins: [event page](https://www.wemakedevs.org/hackathons/falkordb).

## SIMULATION (where it breaks)
- **Day 1:** gate-file and KEP parsing work by evening, but the stage history per release is messy (gates renamed, gates with no KEP). **Day 2:** claim extraction finds that manifests with removed apiVersions in the English docs are rare, because the docs team cleans those up. The "60 vs 31" headline turns out to be maybe "40 vs 8". **Day 3:** fetching reviewers through the GitHub API is throttled, so the builder falls back to `git log` authors only. Backtest and MCP get cut.
- **Demo:** shot 1 lands only if the numbers are big. Shot 4 (backtest) and shot 5 (agent) are probably missing.
- **Judge questions:** "Why not a Python script?" (weak answer). "What did Pluto miss?" "How many true positives?" "Did maintainers accept your issues?" (probably no reply within 4 days). "Where is the company brain?"

## STEELMAN vs ATTACK
**For:** the data is real and public, the ground truth is real, precision is measured, and outside proof is possible. Few entries will be this honest.
**Against:** the finding count may be tiny, the graph is thin, the track fit is loose, and the most memorable parts are optional.

## TOP 3 FLAWS
1. **Not enough findings.** Scenario: after exclusions and the history classifier, only 5–10 truly stale English pages remain. "Graph beats grep" becomes a tiny sample, and the backtest's recall number is statistically meaningless.
2. **The graph is decoration in disguise.** Scenario: a judge applies the "remove FalkorDB" test. The detector is a join over two tables. Only the owner routing needs relationships, and that is shallow.
3. **Scope against a solo 4-day build.** Scenario: day 3 ends with the people layer half-done, so there is no agent guard (the Track 1 entry dies) and no backtest. The demo is a list of cards.

## THE BEST VERSION
Cut the GitHub reviewer API (use `git log` and OWNERS only) and the upstream-filing promise. Move the `is_current` MCP agent guard ABOVE the cut line: it is the vivid moment and the honest graph use (multi-hop validation for every snippet at query time). Add "blast radius": LINKS_TO plus PageRank to rank which stale pages hurt most. Before committing, spend the first 3 hours measuring the real finding count.

## VERDICT
Build it with changes: run the finding count first, and if it comes in under ~15 real stale pages, pivot the pitch to the agent guard.
