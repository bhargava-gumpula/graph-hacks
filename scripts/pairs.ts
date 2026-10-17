// Pair census: how many file pairs can a lock, a one-hop check and the import graph each see?
// Usage: npm run pairs   (FalkorDB on localhost:6379). Writes bench/pairs.json.
//
// Runs the census query (packages/core/src/queries/pairs.ts) on two temp graphs, then drops them:
//   demo: demo-repo, the repo the landing page walks through.
//   real: apps/web, Switchboard's own web app, so the numbers are not about a planted toy.
//         (apps/web, not apps/web/src: its tsconfig, which holds the `@/` alias, sits one level up.)
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { connect, ensureSchema, loadParse, parseRepo } from "../packages/core/src/index.js";
import { pairCensus } from "../packages/core/src/queries/pairs.js";

const ROOT = resolve(import.meta.dirname, "..");
const NS = process.env.SB_TEST_NS ?? "";
const RUNS = 5;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function census(name: string, dir: string) {
  const g = await connect({ graph: `sb_pairs_${name}${NS}` });
  try {
    await g.drop().catch(() => undefined);
    await ensureSchema(g);
    await loadParse(g, parseRepo(dir)); // also marks hubs
    const timings: number[] = [];
    let result = await pairCensus(g);
    for (let i = 0; i < RUNS; i++) {
      const started = performance.now();
      result = await pairCensus(g);
      timings.push(performance.now() - started);
    }
    const { byHop, ...counts } = result;
    return { dir: relative(ROOT, dir), ...counts, byHop, ms: Math.round(median(timings) * 100) / 100 };
  } finally {
    await g.drop().catch(() => undefined);
    await g.close();
  }
}

const out = {
  demo: await census("demo", join(ROOT, "demo-repo")),
  real: await census("real", join(ROOT, "apps/web")),
  note: `pairs are unordered pairs of distinct files; ms is the median of ${RUNS} runs of the census query`,
  ranAt: new Date().toISOString(),
};
await mkdir(join(ROOT, "bench"), { recursive: true });
await writeFile(join(ROOT, "bench/pairs.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
