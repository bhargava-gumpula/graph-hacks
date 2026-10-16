// Same edit, ten times, with the conflict check and without it.
// Without: the edit lands and `tsc` fails. With: the graph blocks it and `tsc` stays green.
// This is a scripted pair of agents, not live LLM sessions. The only difference is whether we obey FalkorDB.
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  claim,
  connect,
  ensureSchema,
  findConflicts,
  loadParse,
  parseRepo,
  release,
} from "../packages/core/src/index.js";

const exec = promisify(execFile);
const N = Number(process.env.BENCH_N ?? 10);
const ROOT = resolve(import.meta.dirname, "..");
const DEMO = join(ROOT, "demo-repo");
const LOGIN = "ui/LoginForm.tsx";
const SESSION = "auth/session.ts";

/** Drop the import and leave the call. TypeScript then fails. */
function breakLogin(source: string): string {
  return source.replace('import { login, loginHeadline } from "../api/login";\n', "");
}

async function typechecks(dir: string): Promise<boolean> {
  try {
    await exec("npx", ["tsc", "-p", dir, "--pretty", "false"], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

async function trial(mode: "with" | "without"): Promise<{ blocked: boolean; tscOk: boolean; checkMs: number }> {
  const dir = await mkdtemp(join(tmpdir(), "sb-bench-"));
  const g = await connect({ graph: "sb_bench" });
  try {
    await ensureSchema(g);
    await g.drop().catch(() => undefined);
    await ensureSchema(g);
    await loadParse(g, parseRepo(DEMO));
    await g.query("MATCH (f:File {path: $p}) SET f.hub = true", { p: "lib/utils.ts" });
    await release(g, { agent: "A" });
    await claim(g, { agent: "A", paths: [SESSION], taskId: "bench" });

    const started = performance.now();
    const conflicts = await findConflicts(g, { agent: "B", paths: [LOGIN] });
    const checkMs = performance.now() - started;
    const blocked = conflicts.length > 0;
    const apply = mode === "without" || !blocked;

    await cp(DEMO, dir, { recursive: true });
    if (apply) {
      const file = join(dir, LOGIN);
      await writeFile(file, breakLogin(await readFile(file, "utf8")));
    }
    return { blocked: mode === "with" && blocked, tscOk: await typechecks(dir), checkMs };
  } finally {
    await g.close();
    await rm(dir, { recursive: true, force: true });
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

const without = [];
const withSb = [];
for (let i = 0; i < N; i++) {
  without.push(await trial("without"));
  withSb.push(await trial("with"));
  console.log(`trial ${i + 1}/${N}`);
}

const results = {
  n: N,
  kind: "scripted agents, same edit, real tsc, real FalkorDB conflict check",
  without: {
    brokenBuilds: without.filter((t) => !t.tscOk).length,
    editsApplied: N,
  },
  with: {
    brokenBuilds: withSb.filter((t) => !t.tscOk).length,
    blocked: withSb.filter((t) => t.blocked).length,
  },
  checkMsMedian: Math.round(median(withSb.map((t) => t.checkMs)) * 10) / 10,
};

const json = JSON.stringify(results, null, 2);
await mkdir(join(ROOT, "bench"), { recursive: true });
await mkdir(join(ROOT, "apps/web/public/bench"), { recursive: true });
await writeFile(join(ROOT, "bench/results.json"), json);
await writeFile(join(ROOT, "apps/web/public/bench/results.json"), json);

const report = `# Benchmark

${results.kind}.

Each trial copies \`demo-repo\`. Agent A has claimed \`auth/session.ts\`. Agent B's edit deletes the import in \`ui/LoginForm.tsx\` and leaves the call, so \`tsc\` fails if the edit lands.

| | Broken builds | What happened |
|---|---|---|
| Without Switchboard | ${results.without.brokenBuilds} / ${N} | The edit was applied every time |
| With Switchboard | ${results.with.brokenBuilds} / ${N} | The edit was blocked ${results.with.blocked} / ${N} times |

Median conflict check: **${results.checkMsMedian} ms**.

The graph is the only difference between the two columns.
`;
await writeFile(join(ROOT, "bench/REPORT.md"), report);
console.log(report);
