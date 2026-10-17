import type { ClaimResult } from "./queries/claims.js";
import { claim } from "./queries/claims.js";
import { findConflicts } from "./queries/conflict.js";
import { loadParse } from "./queries/loader.js";
import { SET_TASK_STATUS, parallelBatches, planTask } from "./queries/schedule.js";
import { recordEdit } from "./queries/edits.js";
import { recordDecision, whyTrace } from "./queries/why.js";
import { registerAgent } from "./queries/agents.js";
import { release } from "./queries/claims.js";
import { ensureSchema } from "./queries/schema.js";
import { parseRepo } from "./parser.js";
import type { SbGraph } from "./graph.js";

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
  sentence: string;
  /** How long the conflict check itself took, not the whole demo. */
  checkMs: number;
}

/** Parse the demo repo, then play the conflict, the batches, and the why-trace. */
export async function runMvpScenario(g: SbGraph, demoRoot: string): Promise<MvpScenarioResult> {
  await ensureSchema(g);
  const counts = await loadParse(g, parseRepo(demoRoot));
  await release(g, { agent: A });
  await release(g, { agent: B });
  await registerAgent(g, { id: A, kind: "cursor" });
  await registerAgent(g, { id: B, kind: "claude" });

  const a = await claim(g, { agent: A, paths: [SESSION], taskId: "T1", intent: "session ttl" });
  if (!a.ok) throw new Error(`A was refused ${SESSION}: ${JSON.stringify(a.conflicts)}`);

  const started = performance.now();
  await findConflicts(g, { agent: B, paths: [LOGIN] });
  const checkMs = Math.round((performance.now() - started) * 10) / 10;
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
  await g.query(SET_TASK_STATUS, { id: "T3", status: "done" });
  const why = (await whyTrace(g, "lib/crypto.ts"))[0]?.path ?? [];
  const hit = b.conflicts[0]!;
  const sentence =
    `Agent B cannot edit ${hit.file}. It reaches ${hit.claimed}, which agent ${hit.agent} is already changing, ` +
    `through ${hit.path.join(" → ")}. A file lock would have allowed the edit.`;

  return { files: counts.files, imports: counts.imports, a, b, batches, why, sentence, checkMs };
}
