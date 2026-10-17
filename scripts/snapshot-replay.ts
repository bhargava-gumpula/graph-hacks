// Record one real FalkorDB run of the demo into apps/web/public/replay.json: the clearly labelled
// fallback /app shows when the API is down. Usage: npx tsx scripts/snapshot-replay.ts
// Works on a temp graph (sb_replay) and deletes it at the end.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  blastRadius,
  brief,
  conflictQuery,
  connect,
  ensureSchema,
  feedSince,
  findConflicts,
  formatBrief,
  graphSnapshot,
  latestSeq,
  listClaims,
  listDecisions,
  loadParse,
  parallelBatches,
  parseRepo,
  runMvpScenario,
  whyTrace,
} from "../packages/core/src/index.js";
import { blastQuery } from "../packages/core/src/queries/blast.js";
import { NEAR_FILES } from "../packages/core/src/queries/brief.js";
import { claimQuery } from "../packages/core/src/queries/claims.js";
import { conflictGuard } from "../packages/core/src/queries/conflict.js";
import { MARK_HUBS } from "../packages/core/src/queries/hubs.js";
import { WCC_BATCHES, interfereQuery } from "../packages/core/src/queries/schedule.js";
import { WHY_TRACE } from "../packages/core/src/queries/why.js";

const root = join(import.meta.dirname, "..");
const out = join(root, "apps/web/public/replay.json");
const TASKS = ["T1", "T2", "T3", "t-login", "t-session", "t-settings", "t-prefs", "t-about"];

const g = await connect({ graph: "sb_replay" });
try {
  await g.drop().catch(() => undefined); // a leftover from an aborted run
  await ensureSchema(g);
  await loadParse(g, parseRepo(join(root, "demo-repo")));
  const seq0 = await latestSeq(g);
  const result = await runMvpScenario(g, join(root, "demo-repo"));

  const graph = await graphSnapshot(g);
  const files = graph.nodes.filter((n) => n.kind === "file").map((n) => n.id);
  const perFile = async <T>(fn: (path: string) => Promise<T>) =>
    Object.fromEntries(await Promise.all(files.map(async (p) => [p, await fn(p)] as const)));

  const replay = {
    capturedAt: new Date().toISOString(),
    graph,
    claims: await listClaims(g),
    decisions: await listDecisions(g),
    batches: await parallelBatches(g),
    demo: { sentence: result.sentence, checkMs: result.checkMs, path: result.b.conflicts[0]?.path ?? [] },
    events: await feedSince(g, seq0, 1000),
    blast: await perFile((p) => blastRadius(g, p)),
    why: await perFile((p) => whyTrace(g, p)),
    check: await perFile((p) => findConflicts(g, { agent: "B", paths: [p] })),
    brief: Object.fromEntries(
      await Promise.all(
        TASKS.map(async (t) => {
          const b = await brief(g, { taskId: t });
          return [t, { ...b, text: formatBrief(b) }] as const;
        }),
      ),
    ),
    // Same shape as GET /api/cypher.
    cypher: {
      conflict: conflictQuery(3),
      guard: conflictGuard(3),
      claim: claimQuery(3),
      blast: blastQuery(3),
      interferes: interfereQuery(3),
      batches: WCC_BATCHES,
      hubs: MARK_HUBS,
      why: WHY_TRACE,
      brief: NEAR_FILES,
    },
  };
  const json = JSON.stringify(replay);
  writeFileSync(out, json);
  console.log(`wrote ${out}: ${(json.length / 1024).toFixed(0)} KB, ${files.length} files, ${replay.events.length} events`);
} finally {
  await g.drop();
  await g.close();
}
