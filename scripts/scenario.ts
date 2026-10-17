// The two-minute demo story in the terminal. Usage: npm run scenario [-- <demo dir>]
// Graph: SB_GRAPH (default sb_demo). Same steps as POST /api/demo.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, resetDemo, runMvpScenario, type MvpScenarioResult } from "../packages/core/src/index.js";

const SESSION = "auth/session.ts";
const LOGIN = "ui/LoginForm.tsx";

function format(result: MvpScenarioResult): string {
  const c = result.b.conflicts[0];
  if (!c) throw new Error("scenario expected B's claim to conflict, but it did not");
  return [
    result.sentence,
    `checked in ${result.checkMs} ms`,
    `parsed ${result.files} files, ${result.imports} imports`,
    `A claimed ${SESSION} until ${new Date(result.a.until).toISOString()} seq=${result.a.seq}`,
    `B claimed ${LOGIN} → CONFLICT ${c.type} ${c.hops} hops`,
    `  ${c.path.join(" → ")} ← ${c.agent}`,
    `batches: ${result.batches.map((batch) => batch.join("+")).join(" | ")}`,
    `why: ${result.why.join(" → ")}`,
  ].join("\n");
}

export { runMvpScenario };

async function main(): Promise<void> {
  const demo = resolve(process.argv[2] ?? "demo-repo");
  const g = await connect();
  try {
    await resetDemo(g);
    console.log(format(await runMvpScenario(g, demo)));
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
