# Contrarian review: Kubernetes "version truth" MCP server (candidate 2)

## SCORES (1–10)
- **Graph essential: 4.** The headline feature, `is_current`, is a key-value lookup (apiVersion+Kind → removed-in, replacement). Pluto does exactly this from a flat YAML file, so the core passes the "take FalkorDB out" test. Only the day-3 include/link propagation needs the graph, and that's the part most likely to be cut.
- **Demo memorability: 5.** "Agent corrects itself and cites the KEP" is clean but dry. The removals used in the demo (CronJob `batch/v1beta1`, Ingress `extensions/v1beta1`, HPA `v2beta2`) date from 2022–23, and current Claude models mostly write them correctly already. To make the hook fire, the builder has to stage the prompt, and judges will notice.
- **4-day feasibility: 5.** That's five parsers (Hugo `code_sample` shortcodes, `feature-state` badges, kep.yaml, feature-gate front matter, OWNERS plus git log), an MCP server, a Claude Code hook, a canvas, LLM classification and a tunnel deploy. For one person it's realistic only if day 3 slips.
- **Originality: 5.** Static deprecation scanning is a solved problem (Pluto, kubent, kubeconform), and version-aware docs for agents exist too (Context7, kubernetools MCP). I found no existing project that ranks docs by stale-impact with KEP provenance. That's a real but narrow gap.
- **Real-world usefulness: 4.** The agent guard repeats `pluto detect-files` or `kubectl apply --dry-run=server`, which the cluster rejects anyway. The docs-ranking user group is roughly a dozen SIG Docs maintainers.

## WIN CHANCE (main track: Agents That Act on Connected Data): ~4%
Out of 100–300 real entries, this one is competent and honest but niche. Judges from WeMakeDevs/FalkorDB won't feel the K8s-docs pain, and the graph work they'd reward is hidden behind a lookup-table demo. The Company Brain track fits slightly better (ownership, provenance, keeping knowledge current), but "the company" being the K8s project is a stretch there.

## EVIDENCE
- Pluto already scans files and Helm releases for deprecated vs removed APIs, with CI exit codes; kubent covers live clusters ([Fairwinds](https://fairwinds.com/blog/update-on-pluto-and-how-this-open-source-project-can-identify-deprecated-apis-in-kubernetes-1.22), [Plural guide](https://www.plural.sh/blog/kubernetes-api-deprecation-tool-guide/)).
- kubeconform validates against per-version OpenAPI schemas, so a removed apiVersion has no schema to match ([Wiz](https://www.wiz.io/academy/kubeconform-overview)).
- I found no deprecation-check MCP server, but kubernetools MCP already serves version-specific API reference to agents ([mcpservers.org](https://mcpservers.org/pt-BR/servers/kubernetools/mcp-server)). Context7 pins docs by version ([Context7](https://context7.com/guides)).
- Recent removals are few and obscure: v1.32 removed flowcontrol `v1beta3`, and no comparable v1.33 removal turned up ([v1.35 guide](https://v1-35.docs.kubernetes.io/docs/reference/using-api/deprecation-guide/)). The truth layer is small, and the removals that would make a vivid demo are old.
- FalkorDB's `CALL algo.pageRank(label, rel) YIELD node, score` exists, so the PageRank claim holds ([FalkorDB docs](https://docs.falkordb.com/algorithms/pagerank.html)).
- I found no published winners from past WeMakeDevs/FalkorDB Graph Hacks, so there are no winner patterns to calibrate against ([event pages](https://www.wemakedevs.org/hackathons/falkordb)).

## SIMULATION (where it breaks)
- **Day 1:** Parsing is fine, but in the hour-3 stale count, kubernetes/website is heavily maintained, so expect few true stale examples. The fallback triggers and the graph half shrinks.
- **Day 2:** The MCP server and hook work. Demo rehearsal: Claude writes `batch/v1` CronJob unprompted, nothing fires, so the builder forces a v1beta1 snippet.
- **Day 3:** Badge and claim parsing is noisy, so "history vs current" classification needs hand-checking. The canvas is rushed.
- **Day 4:** Deploy, video, README.
- **Skeptical judge questions:**
  1. "How is this different from Pluto?" No good answer for the guard.
  2. "Delete FalkorDB. Does `is_current` still work?" Yes.
  3. "How many real stale pages did you find?" Possibly fewer than 15.
  4. "Did upstream accept your issue?" Unknown by the deadline.
  5. "Who installs this?" Vague.

## STEELMAN vs ATTACK
- **For:** All the data is public and real, the provenance chain (release → KEP → SIG → editor) is genuinely multi-hop, the brief is unusually honest (grep baseline, kill-switch at 15 findings), and a filed upstream issue is real-world proof.
- **Against:** The part that demos best is the part that needs no graph. The part that needs the graph is the part least likely to exist, and has too few real findings to impress anyone.

## TOP 3 FLAWS
1. **The graph is decoration in the headline feature.** A judge asks "what if FalkorDB is removed?", the honest answer is "`is_current` becomes a dict lookup", and the rule's own wording disqualifies the pitch.
2. **The demo premise is stale.** Modern models no longer emit 2022-era removed APIs, so the self-correction moment is staged. Here's how that plays out: the video shows a hand-fed bad manifest, and the judge concludes there's no real problem.
3. **Thin real findings.** The day-1 count returns about 6 stale examples, the "one file fixes many pages" canvas lights up 2 nodes, and the grep baseline finds the same 6.

## THE BEST VERSION
Flip the pitch. Lead with **docs impact and provenance**: a docs-maintenance agent that, given an upcoming removal (use announced future deprecations, not past ones), traverses gate/API → examples → including pages → linked pages → SIG and recent editors, and produces a ranked, cited fix list. Keep `is_current` as a 15-second side tool. Add a "what breaks in v1.(N+1)" forward-looking query, which is where real findings exist. Cut the Claude Code hook polish and the PageRank-as-traffic claim (it's an unvalidated proxy). Enter Company Brain as co-main.

## VERDICT
**Build it with changes.** As pitched, the demo shows its weakest graph story. Re-center it on forward-looking docs-impact traversal, or the graph is decoration and the problem is staged.
