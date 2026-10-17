// With/without benchmark behind the landing-page numbers. Usage: npm run bench   (BENCH_N=10)
//
// Scripted agents, not live LLM sessions. Agent A holds a claim on auth/session.ts. Agent B makes
// the same edit every trial: it deletes an import in ui/LoginForm.tsx (two import hops from A's file)
// and leaves the call, so real `tsc` fails whenever the edit lands.
//   without: B edits blindly.
//   with:    B runs the real FalkorDB conflict check first and skips the edit if it reports a conflict.
// The check is the only difference between the two columns. checkMs is timed around findConflicts alone.
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
  markHubs,
  parseRepo,
  release,
  type SbGraph,
} from "../packages/core/src/index.js";

const exec = promisify(execFile);
const N = Number(process.env.BENCH_N ?? 10);
const GRAPH = process.env.SB_BENCH_GRAPH ?? "sb_bench";
const ROOT = resolve(import.meta.dirname, "..");
const DEMO = join(ROOT, "demo-repo");
const TSC = join(ROOT, "node_modules/.bin/tsc");
const LOGIN = "ui/LoginForm.tsx";
const SESSION = "auth/session.ts";
const IMPORT_LINE = 'import { login, loginHeadline } from "../api/login";\n';

if (!Number.isInteger(N) || N < 1) throw new Error(`BENCH_N must be a positive integer, got ${process.env.BENCH_N}`);

interface Trial {
  applied: boolean;
  blocked: boolean;
  tscOk: boolean;
  checkMs: number | null;
}

/** B's edit: drop the import, keep the call. */
function breakLogin(source: string): string {
  if (!source.includes(IMPORT_LINE)) throw new Error(`${LOGIN} no longer has the import the benchmark removes`);
  return source.replace(IMPORT_LINE, "");
}

async function typechecks(dir: string): Promise<boolean> {
  try {
    await exec(TSC, ["-p", dir, "--pretty", "false"]);
    return true;
  } catch {
    return false;
  }
}

/** A fresh copy of the demo repo; B's edit lands in it only if `apply`. */
async function buildAfterEdit(apply: boolean): Promise<boolean> {
  const dir = await mkdtemp(join(tmpdir(), "sb-bench-"));
  try {
    await cp(DEMO, dir, { recursive: true });
    if (apply) {
      const file = join(dir, LOGIN);
      await writeFile(file, breakLogin(await readFile(file, "utf8")));
    }
    return await typechecks(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function trial(g: SbGraph, mode: "with" | "without"): Promise<Trial> {
  // Same starting state every trial: only A's claim is live.
  await release(g, { agent: "A" });
  await release(g, { agent: "B" });
  const a = await claim(g, { agent: "A", paths: [SESSION], taskId: "bench" });
  if (!a.ok) throw new Error("agent A could not claim its file");

  let blocked = false;
  let checkMs: number | null = null;
  if (mode === "with") {
    const started = performance.now();
    const conflicts = await findConflicts(g, { agent: "B", paths: [LOGIN] });
    checkMs = performance.now() - started;
    blocked = conflicts.length > 0;
  }
  const applied = !blocked;
  return { applied, blocked, tscOk: await buildAfterEdit(applied), checkMs };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const round = (ms: number) => Math.round(ms * 100) / 100;

const g = await connect({ graph: GRAPH });
const without: Trial[] = [];
const withSb: Trial[] = [];
let baselineTscOk: boolean;
try {
  await g.drop().catch(() => undefined);
  await ensureSchema(g);
  const counts = await loadParse(g, parseRepo(DEMO));
  await markHubs(g);
  console.log(`graph ${GRAPH}: ${counts.files} files, ${counts.imports} imports`);

  // The control: the untouched repo must typecheck, or a broken build would prove nothing.
  baselineTscOk = await buildAfterEdit(false);
  if (!baselineTscOk) throw new Error("demo-repo does not typecheck before the edit");

  for (let i = 0; i < N; i++) {
    without.push(await trial(g, "without"));
    withSb.push(await trial(g, "with"));
    console.log(`trial ${i + 1}/${N}`);
  }
} finally {
  await g.drop().catch(() => undefined);
  await g.close();
}

const checkSamples = withSb.map((t) => t.checkMs!);
const results = {
  n: N,
  kind: "scripted agents, same edit, real tsc, real FalkorDB conflict check",
  without: {
    brokenBuilds: without.filter((t) => !t.tscOk).length,
    editsApplied: without.filter((t) => t.applied).length,
  },
  with: {
    brokenBuilds: withSb.filter((t) => !t.tscOk).length,
    blocked: withSb.filter((t) => t.blocked).length,
    editsApplied: withSb.filter((t) => t.applied).length,
  },
  checkMsMedian: round(median(checkSamples)),
  checkMsMin: round(Math.min(...checkSamples)),
  checkMsMax: round(Math.max(...checkSamples)),
  checkMsSamples: checkSamples.map(round),
  baselineTscOk,
  edit: { agent: "B", file: LOGIN, removes: IMPORT_LINE.trim() },
  claim: { agent: "A", file: SESSION },
  tsc: (await exec(TSC, ["--version"])).stdout.trim(),
  node: process.version,
  ranAt: new Date().toISOString(),
};

const json = JSON.stringify(results, null, 2) + "\n";
await mkdir(join(ROOT, "bench"), { recursive: true });
await mkdir(join(ROOT, "apps/web/public/bench"), { recursive: true });
await writeFile(join(ROOT, "bench/results.json"), json);
await writeFile(join(ROOT, "apps/web/public/bench/results.json"), json);

const report = `# Benchmark

${results.kind}. Reproduce with \`npm run bench\` (FalkorDB on localhost:6379, \`BENCH_N\` sets the run count).

Each trial copies \`demo-repo\` and runs real \`tsc\` (${results.tsc}) on it. Agent A has claimed \`${SESSION}\`. Agent B's edit deletes \`${results.edit.removes}\` from \`${LOGIN}\` and leaves the call, so \`tsc\` fails if the edit lands. The untouched repo typechecks (the control).

| | Broken builds | What happened |
|---|---|---|
| Without Switchboard | ${results.without.brokenBuilds} / ${N} | The edit was applied ${results.without.editsApplied} / ${N} times |
| With Switchboard | ${results.with.brokenBuilds} / ${N} | The conflict check blocked the edit ${results.with.blocked} / ${N} times |

Conflict check (\`findConflicts\`, one FalkorDB path query): median **${results.checkMsMedian} ms**, range ${results.checkMsMin}–${results.checkMsMax} ms over ${N} runs.

The graph is the only difference between the two columns. These are scripted agents, not live LLM sessions.
`;
await writeFile(join(ROOT, "bench/REPORT.md"), report);
console.log(report);
