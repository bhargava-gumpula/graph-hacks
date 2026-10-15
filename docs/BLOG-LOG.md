# BLOG-LOG: raw material for the Switchboard blog post (AirPods prize)

Add an entry whenever something blog-worthy happens. Format: `## <date time> — <title>`, 2–5 lines, plus the asset path in docs/blog-assets/.

## 2026-10-13 — How we picked the idea: ~150 AI advisors, one graph
We ran blind "councils" of five AI advisors (Contrarian, First Principles, Expansionist, Outsider, Executor) per idea, each doing its own web research. No idea ever scored above about 10–11% to win. Calibrated advisors are humbling. The owner picked Switchboard because it's the problem they live every day: running several AI coding agents on one repo.

## 2026-10-13 — The one query that justifies the graph
`MATCH p=(f:File {path:$mine})-[:IMPORTS*1..3]->(t)<-[:CLAIMS]-(a:Agent) RETURN p`. If it returns a path, two agents are about to collide through a dependency chain that no file lock would catch. If it returns nothing, that empty result *is the proof* that they can safely run in parallel.
