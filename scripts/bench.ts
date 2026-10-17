// With/without benchmark behind the landing-page numbers. Usage: npm run bench   (BENCH_N=10)
//
// Scripted agents, not live LLM sessions. Two edits that each typecheck alone and fail when merged:
//   A's edit, auth/session.ts: sessionLabel returns { user, at } instead of a string.
//   B's edit, ui/LoginForm.tsx: appends result.label.toUpperCase().
// api/login.ts declares `label: ReturnType<typeof sessionLabel>`, so A's new return type reaches B's
// call two import hops away. Neither edit touches the other's file.
//
//   without: a plain file lock. It refuses only the same path, so both agents get their lock, both
//            edits land, and we run tsc on the merge.
//   with:    A claims session.ts through Switchboard. B's claim on LoginForm.tsx is refused (a real
//            claim() on a real FalkorDB graph). A's edit lands and A releases, B's claim now succeeds,
//            B applies its edit on top of A's and runs tsc. That fails, so B's edit does not land.
//            We run tsc on what did land.
// Nothing is random: each trial repeats the same steps, so N shows repeatability, not a statistic.
// checkMs is timed around findConflicts alone (the read-only check inside claim()); claimMs is the
// whole refused claim() call. tsc runs one at a time so it never competes with a timed query.
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { cpus, loadavg, tmpdir } from "node:os";
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
  type Conflict,
  type SbGraph,
} from "../packages/core/src/index.js";

const exec = promisify(execFile);
const N = Number(process.env.BENCH_N ?? 10);
// Its own graph per checkout (SB_TEST_NS), never the live demo's sb_demo.
const GRAPH = process.env.SB_BENCH_GRAPH ?? `sb_bench${process.env.SB_TEST_NS ?? ""}`;
if (GRAPH === "sb_demo") throw new Error("the benchmark drops its graph; refusing sb_demo");
const ROOT = resolve(import.meta.dirname, "..");
const DEMO = join(ROOT, "demo-repo");
const TSC = join(ROOT, "node_modules/.bin/tsc");
const SESSION = "auth/session.ts";
const LOGIN = "ui/LoginForm.tsx";
const LOGIN_API = "api/login.ts";
const LABEL_TYPE = "label: ReturnType<typeof sessionLabel>;";

if (!Number.isInteger(N) || N < 1) throw new Error(`BENCH_N must be a positive integer, got ${process.env.BENCH_N}`);

interface Edit {
  agent: "A" | "B";
  file: string;
  from: string;
  to: string;
}

const A_EDIT: Edit = {
  agent: "A",
  file: SESSION,
  from: `export function sessionLabel(session: OpenSession): string {
  return session.userId + "@" + session.openedAt;
}`,
  to: `export function sessionLabel(session: OpenSession): { user: string; at: string } {
  return { user: session.userId, at: session.openedAt };
}`,
};

const B_EDIT: Edit = {
  agent: "B",
  file: LOGIN,
  from: 'return who + " " + loginHeadline(result);',
  to: 'return who + " " + loginHeadline(result) + " · " + result.label.toUpperCase();',
};

interface Build {
  ok: boolean;
  /** The first compiler error, with the temp dir stripped from the path. */
  error?: string;
}

/** Copy demo-repo, apply the edits, run the real tsc on the result. */
async function build(edits: Edit[]): Promise<Build> {
  const dir = await mkdtemp(join(tmpdir(), "sb-bench-"));
  try {
    await cp(DEMO, dir, { recursive: true });
    for (const edit of edits) {
      const file = join(dir, edit.file);
      const source = await readFile(file, "utf8");
      if (!source.includes(edit.from)) throw new Error(`${edit.file} no longer has the text edit ${edit.agent} replaces`);
      await writeFile(file, source.replace(edit.from, edit.to));
    }
    try {
      await exec(TSC, ["-p", dir, "--pretty", "false"]);
      return { ok: true };
    } catch (err) {
      const line = String((err as { stdout?: string }).stdout ?? err).split("\n").find((l) => l.includes("error TS")) ?? "tsc failed";
      return { ok: false, error: line.replace(/^.*?((?:auth|api|ui|lib)\/\S+\.tsx?\()/, "$1") };
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** What a plain file lock does: it refuses only a path someone already holds. */
const lockAllows = (held: string[], want: string) => !held.includes(want);

interface WithoutTrial {
  lockGranted: boolean;
  buildOk: boolean;
}

/** Without Switchboard: the lock allows B (a different file), both edits land, tsc runs on the merge. */
async function withoutTrial(): Promise<WithoutTrial> {
  const lockGranted = lockAllows([SESSION], LOGIN);
  const landed = lockGranted ? [A_EDIT, B_EDIT] : [A_EDIT];
  return { lockGranted, buildOk: (await build(landed)).ok };
}

interface WithTrial {
  blocked: boolean;
  caught: boolean;
  buildOk: boolean;
  checkMs: number;
  claimMs: number;
  conflict: Conflict | undefined;
}

/** With Switchboard: B is refused, waits for A, rebases, and its own tsc stops its edit. */
async function withTrial(g: SbGraph): Promise<WithTrial> {
  // Same starting state every trial: only A's claim is live.
  await release(g, { agent: "A" });
  await release(g, { agent: "B" });
  const a = await claim(g, { agent: "A", paths: [SESSION], taskId: "bench" });
  if (!a.ok) throw new Error("agent A could not claim its file");

  // B asks for LoginForm.tsx while A holds session.ts.
  let started = performance.now();
  const [conflict] = await findConflicts(g, { agent: "B", paths: [LOGIN] });
  const checkMs = performance.now() - started;
  started = performance.now();
  const first = await claim(g, { agent: "B", paths: [LOGIN], taskId: "bench" });
  const claimMs = performance.now() - started;
  const blocked = !first.ok;

  // A's edit lands (it typechecks alone, see the controls) and A releases. B's retry now succeeds.
  await release(g, { agent: "A" });
  const retry = await claim(g, { agent: "B", paths: [LOGIN], taskId: "bench" });
  if (!retry.ok) throw new Error("agent B could not claim its file after A released");

  // B rebases onto A's edit and runs its own tsc. If it is red, B's edit does not land.
  const rebased = await build([A_EDIT, B_EDIT]);
  await release(g, { agent: "B" });
  const caught = !rebased.ok;
  const buildOk = caught ? (await build([A_EDIT])).ok : rebased.ok;
  return { blocked, caught, buildOk, checkMs, claimMs, conflict };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const round = (ms: number) => Math.round(ms * 100) / 100;
const count = <T>(xs: T[], pick: (x: T) => boolean) => xs.filter(pick).length;

const g = await connect({ graph: GRAPH });
const without: WithoutTrial[] = [];
const withSb: WithTrial[] = [];
const graphSize = { files: 0, imports: 0 };
let controls: { baseline: Build; aAlone: Build; bAlone: Build; merged: Build };
try {
  await g.drop().catch(() => undefined);
  await ensureSchema(g);
  const counts = await loadParse(g, parseRepo(DEMO));
  await markHubs(g);
  Object.assign(graphSize, counts);
  console.log(`graph ${GRAPH}: ${counts.files} files, ${counts.imports} imports`);

  // The controls. Each edit must typecheck alone and the merge must not, or the trials prove nothing.
  if (!(await readFile(join(DEMO, LOGIN_API), "utf8")).includes(LABEL_TYPE)) {
    throw new Error(`${LOGIN_API} must declare \`${LABEL_TYPE}\` so A's return type reaches B's call`);
  }
  controls = { baseline: await build([]), aAlone: await build([A_EDIT]), bAlone: await build([B_EDIT]), merged: await build([A_EDIT, B_EDIT]) };
  console.log(
    `controls: baseline ${controls.baseline.ok ? "green" : "RED"}, A alone ${controls.aAlone.ok ? "green" : "RED"}, ` +
      `B alone ${controls.bAlone.ok ? "green" : "RED"}, merged ${controls.merged.ok ? "green" : "red"}`,
  );
  if (!controls.baseline.ok || !controls.aAlone.ok || !controls.bAlone.ok) {
    throw new Error("a control is red: the benchmark's edits must each typecheck alone");
  }

  for (let i = 0; i < N; i++) {
    without.push(await withoutTrial());
    withSb.push(await withTrial(g));
    console.log(`trial ${i + 1}/${N}`);
  }
} finally {
  await g.drop().catch(() => undefined);
  await g.close();
}

const checkSamples = withSb.map((t) => t.checkMs);
const conflict = withSb[0]?.conflict;
const results = {
  n: N,
  kind: "scripted agents, two edits that each typecheck alone, real tsc, real FalkorDB claims",
  baselineOk: controls.baseline.ok,
  aAloneOk: controls.aAlone.ok,
  bAloneOk: controls.bAlone.ok,
  mergedOk: controls.merged.ok,
  mergedError: controls.merged.error ?? null,
  without: {
    brokenBuilds: count(without, (t) => !t.buildOk),
    editsApplied: count(without, (t) => t.lockGranted),
  },
  with: {
    brokenBuilds: count(withSb, (t) => !t.buildOk),
    blocked: count(withSb, (t) => t.blocked),
    caught: count(withSb, (t) => t.caught),
    editsApplied: count(withSb, (t) => !t.caught),
  },
  runs: {
    without: without.map((t) => (t.buildOk ? "ok" : "tsc-fail")),
    with: withSb.map((t) => (t.blocked ? "refused" : t.buildOk ? "landed" : "tsc-fail")),
  },
  checkMsMedian: round(median(checkSamples)),
  checkMsMin: round(Math.min(...checkSamples)),
  checkMsMax: round(Math.max(...checkSamples)),
  checkMsSamples: checkSamples.map(round),
  claimMsMedian: round(median(withSb.map((t) => t.claimMs))),
  claim: { agent: "A", file: SESSION },
  edit: { agent: "B", file: LOGIN },
  conflict: conflict ? { type: conflict.type, hops: conflict.hops, path: conflict.path } : null,
  graph: graphSize,
  tsc: (await exec(TSC, ["--version"])).stdout.trim(),
  node: process.version,
  // The machine's state at the end of the run: the latency is the one number that depends on it.
  loadAvg1m: round(loadavg()[0]!),
  cpus: cpus().length,
  ranAt: new Date().toISOString(),
};

const json = JSON.stringify(results, null, 2) + "\n";
await mkdir(join(ROOT, "bench"), { recursive: true });
await mkdir(join(ROOT, "apps/web/public/bench"), { recursive: true });
await writeFile(join(ROOT, "bench/results.json"), json);
await writeFile(join(ROOT, "apps/web/public/bench/results.json"), json);

const hops = results.conflict ? `${results.conflict.hops} import hops (${results.conflict.path.join(" → ")})` : "no conflict found";
const report = `# Benchmark

${results.kind}. Reproduce with \`npm run bench\` (FalkorDB on localhost:6379; \`BENCH_N\` sets the run count; the graph is \`${GRAPH}\`, dropped afterwards).

## The scenario

Agent A holds \`${SESSION}\`. Agent B wants \`${LOGIN}\`. The two files are ${hops} apart, and \`${LOGIN_API}\` declares \`${LABEL_TYPE}\`, so a change to \`sessionLabel\`'s return type reaches B's code.

- A's edit, \`${SESSION}\`: \`sessionLabel\` returns \`{ user: string; at: string }\` instead of a string.
- B's edit, \`${LOGIN}\`: appends \`+ " · " + result.label.toUpperCase()\`.

Each edit is run through the real TypeScript compiler (${results.tsc}) on a fresh copy of \`demo-repo\` (${graphSize.files} files, ${graphSize.imports} imports):

| Tree | tsc |
|---|---|
| Untouched repo | ${results.baselineOk ? "green" : "red"} |
| A's edit alone | ${results.aAloneOk ? "green" : "red"} |
| B's edit alone | ${results.bAloneOk ? "green" : "red"} |
| Both edits merged | ${results.mergedOk ? "green" : "red"}${results.mergedError ? `: \`${results.mergedError}\`` : ""} |

Neither agent touches the other's file and neither edit is wrong on its own. The collision exists only in the merge.

## The two columns

- **Without Switchboard**: a plain file lock, which refuses only a path someone already holds. B asks for a different file, gets its lock, and both edits land. tsc runs on the merge.
- **With Switchboard**: A claims \`${SESSION}\` through \`claim()\` on a real FalkorDB graph. B's claim on \`${LOGIN}\` is refused, because A's file is within 3 import hops of it. A's edit lands and A releases. B's claim now succeeds, B applies its edit on top of A's and runs its own tsc, which is red, so B's edit does not land. tsc then runs on what did land.

| | Broken builds | What happened |
|---|---|---|
| Without Switchboard | ${results.without.brokenBuilds} / ${N} | The lock allowed B ${results.without.editsApplied} / ${N} times, both edits landed |
| With Switchboard | ${results.with.brokenBuilds} / ${N} | B's claim was refused ${results.with.blocked} / ${N} times; B's own tsc caught the collision after the rebase ${results.with.caught} / ${N} times |

## Check latency

\`findConflicts\`, the read-only path query inside every claim: median **${results.checkMsMedian} ms**, range ${results.checkMsMin}–${results.checkMsMax} ms over ${N} runs. The whole refused \`claim()\` call (check, a conflict event written to the graph) has a median of ${results.claimMsMedian} ms.

## What this does and does not show

- The run is deterministic. Every trial repeats the same steps on the same files, so ${N} runs show repeatability (the same result every time, a latency range), not a statistic.
- The agents are scripted, not live LLM sessions. B "waits" and A "releases" by direct calls in sequence, not real concurrency.
- The latency is the one measured, noisy number (this run: 1-minute load average ${results.loadAvg1m} on ${results.cpus} cores). The build counts are the same every run by construction; what they prove is that the two edits really do collide under the real compiler and that the claim graph really does refuse the second one.
- Without Switchboard the collision would eventually show up in CI or on the next build. What it costs is a red main branch and a debugging session, not lost data. The benchmark does not model that cost, or the rework B does after its tsc fails.
`;
await writeFile(join(ROOT, "bench/REPORT.md"), report);
console.log(report);
