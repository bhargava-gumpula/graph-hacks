// Demo beats 1–2. Usage: npm run scenario
// Graph: SB_GRAPH (default sb_demo). Does not drop the graph; releases A/B first so it is re-runnable.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  claim,
  connect,
  ensureSchema,
  loadParse,
  parallelBatches,
  parseRepo,
  planTask,
  recordDecision,
  recordEdit,
  registerAgent,
  release,
  whyTrace,
  type ClaimResult,
  type SbGraph,
} from "../packages/core/src/index.js";

const A = "A";
const B = "B";
const SESSION = "auth/session.ts";
const LOGIN = "ui/LoginForm.tsx";
const EXPECTED = [LOGIN, "api/login.ts", SESSION];

export interface MvpScenarioResult {
  files: number;
  imports: number;
  a: Extract<ClaimResult, { ok: true }>;
  b: Extract<ClaimResult, { ok: false }>;
  batches: string[][];
  why: string[];
}

/**
 * Parse the demo repo, register A (Cursor) and B (Claude Code), A claims
 * session.ts, B claims LoginForm.tsx. B must CONFLICT with the import path.
 */
export async function runMvpScenario(g: SbGraph, demoRoot: string): Promise<MvpScenarioResult> {
  await ensureSchema(g);
  const parsed = parseRepo(demoRoot);
  const counts = await loadParse(g, parsed);
  await g.query("MATCH (f:File {path: $p}) SET f.hub = true", { p: "lib/utils.ts" });
  await release(g, { agent: A });
  await release(g, { agent: B });
  await registerAgent(g, { id: A, kind: "cursor" });
  await registerAgent(g, { id: B, kind: "claude" });

  const a = await claim(g, { agent: A, paths: [SESSION], taskId: "T1", intent: "session ttl" });
  if (!a.ok) throw new Error(`A was refused ${SESSION}: ${JSON.stringify(a.conflicts)}`);

  const b = await claim(g, { agent: B, paths: [LOGIN], taskId: "T2", intent: "login form" });
  if (b.ok) throw new Error(`B was granted ${LOGIN}; expected CONFLICT`);
  const path = b.conflicts[0]?.path ?? [];
  if (path.join(">") !== EXPECTED.join(">")) {
    throw new Error(`unexpected path ${path.join(" → ")}; expected ${EXPECTED.join(" → ")}`);
  }

  await planTask(g, { id: "t-login", paths: [LOGIN] });
  await planTask(g, { id: "t-session", paths: [SESSION] });
  await planTask(g, { id: "t-settings", paths: ["ui/SettingsPanel.tsx"] });
  await planTask(g, { id: "t-prefs", paths: ["lib/prefs.ts"] });
  await planTask(g, { id: "t-about", paths: ["ui/AboutPage.tsx"] });
  const batches = (await parallelBatches(g)).map((batch) => batch.tasks);

  await recordDecision(g, {
    agent: A,
    text: "use argon2, not bcrypt",
    why: "FIPS note",
    paths: ["lib/crypto.ts"],
    taskId: "T3",
    id: "D-argon2",
  });
  await recordEdit(g, { agentId: A, path: "lib/crypto.ts", taskId: "T3" });
  const why = (await whyTrace(g, "lib/crypto.ts"))[0]?.path ?? [];

  return { files: counts.files, imports: counts.imports, a, b, batches, why };
}

function format(result: MvpScenarioResult): string {
  const c = result.b.conflicts[0]!;
  return [
    `parsed ${result.files} files, ${result.imports} imports`,
    `A claimed ${SESSION} until ${new Date(result.a.until).toISOString()} seq=${result.a.seq}`,
    `B claimed ${LOGIN} → CONFLICT ${c.type} ${c.hops} hops`,
    `  ${c.path.join(" → ")} ← ${c.agent}`,
    `batches: ${result.batches.map((batch) => batch.join("+")).join(" | ")}`,
    `why: ${result.why.join(" → ")}`,
  ].join("\n");
}

async function main(): Promise<void> {
  const demo = resolve(process.argv[2] ?? "demo-repo");
  const g = await connect();
  try {
    const result = await runMvpScenario(g, demo);
    console.log(format(result));
  } finally {
    await g.close();
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
