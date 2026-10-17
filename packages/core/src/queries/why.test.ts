import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { recordEdit } from "./edits.js";
import { recordEvent } from "./events.js";
import { loadParse } from "./loader.js";
import { listDecisions, recordDecision, whyTrace } from "./why.js";

const g = useTestGraph("sb_test_why");

const AFFECTS = `
MATCH (d:Decision {id: $id})-[:AFFECTS]->(f:File)
RETURN f.path AS path ORDER BY path
`;

beforeAll(async () => {
  await loadParse(g(), parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
});

test("why(crypto.ts) is the edit, the task, the decision and who made it", async () => {
  const id = await recordDecision(g(), {
    agent: "lead",
    text: "use argon2, not bcrypt",
    why: "FIPS note",
    paths: ["lib/crypto.ts"],
    taskId: "T3",
  });
  await recordEdit(g(), { agentId: "A", path: "lib/crypto.ts", taskId: "T3" });

  const hits = await whyTrace(g(), "lib/crypto.ts");
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({
    agent: "A",
    task: "T3",
    decisionId: id,
    decision: "use argon2, not bcrypt",
    why: "FIPS note",
    decidedBy: "lead",
    latestId: null,
    path: ["lib/crypto.ts", "A", "T3", "use argon2, not bcrypt"],
  });
});

test("a superseding decision shows as latest, and the old one is marked superseded", async () => {
  const [old] = await whyTrace(g(), "lib/crypto.ts");
  const newer = await recordDecision(g(), {
    agent: "lead",
    text: "use scrypt",
    why: "argon2 lib unmaintained",
    paths: ["lib/crypto.ts"],
    supersedes: [old!.decisionId!],
  });
  const [hit] = await whyTrace(g(), "lib/crypto.ts");
  expect(hit).toMatchObject({ decision: "use argon2, not bcrypt", latestId: newer, latestText: "use scrypt" });

  const statuses = Object.fromEntries((await listDecisions(g())).map((d) => [d.id, d.status]));
  expect(statuses[old!.decisionId!]).toBe("superseded");
  expect(statuses[newer]).toBe("active");
});

test("decisions on the same file do not supersede each other unless asked", async () => {
  const a = await recordDecision(g(), { agent: "A", text: "TTL 15 min", why: "spec", paths: ["auth/session.ts"] });
  const b = await recordDecision(g(), { agent: "A", text: "cookie is httpOnly", why: "XSS", paths: ["auth/session.ts"] });
  const statuses = Object.fromEntries((await listDecisions(g())).map((d) => [d.id, d.status]));
  expect([statuses[a], statuses[b]]).toEqual(["active", "active"]);
});

test("unknown paths are skipped; re-recording the same id is idempotent", async () => {
  const input = { agent: "A", text: "x", why: "y", paths: ["lib/ids.ts", "nope.ts"], id: "D-fixed" };
  await recordDecision(g(), input);
  await recordDecision(g(), input);
  expect(await g().roQuery(AFFECTS, { id: "D-fixed" })).toEqual([{ path: "lib/ids.ts" }]);
  expect((await listDecisions(g())).filter((d) => d.id === "D-fixed")).toHaveLength(1);
});

test("generated ids never collide, even in the same millisecond", async () => {
  const now = 1_000;
  const ids = await Promise.all(
    [1, 2, 3].map((n) => recordDecision(g(), { agent: "A", text: `d${n}`, why: "w", paths: [], now })),
  );
  expect(new Set(ids).size).toBe(3);
});

test("an edit with no task still says who edited; no edits means an empty trace", async () => {
  await recordEvent(g(), { kind: "edit", agentId: "B", onPath: "lib/time.ts" });
  expect((await whyTrace(g(), "lib/time.ts"))[0]?.path).toEqual(["lib/time.ts", "B", "(no task)", "(no decision)"]);
  expect(await whyTrace(g(), "ui/AboutPage.tsx")).toEqual([]);
});

test("newest edit first, then decisions no edit reached", async () => {
  await recordEdit(g(), { agentId: "A", path: "lib/ids.ts" });
  await recordEdit(g(), { agentId: "B", path: "lib/ids.ts" });
  // D-fixed (above) affects lib/ids.ts but caused no edit: it comes last.
  expect((await whyTrace(g(), "lib/ids.ts")).map((h) => [h.agent, h.decisionId])).toEqual([
    ["B", null],
    ["A", null],
    ["(no tracked edit)", "D-fixed"],
  ]);
});

test("repeated identical edits and decisions give one row per chain, with an edit count and real nodes", async () => {
  const input = { agent: "lead", text: "format dates as ISO", why: "sorting", paths: ["lib/format.ts"], taskId: "T-fmt", id: "D-fmt" };
  await recordDecision(g(), input);
  await recordDecision(g(), input);
  const seqs = [];
  for (let i = 0; i < 3; i++) seqs.push(await recordEdit(g(), { agentId: "A", path: "lib/format.ts", taskId: "T-fmt" }));

  const hits = await whyTrace(g(), "demo-repo/lib/format.ts");
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({
    seq: Math.max(...seqs),
    edits: 3,
    agent: "A",
    task: "T-fmt",
    decisionId: "D-fmt",
    decidedBy: "lead",
    path: ["lib/format.ts", "A", "T-fmt", "format dates as ISO"],
    nodes: [
      { label: "File", id: "lib/format.ts" },
      { label: "Agent", id: "A" },
      { label: "Task", id: "T-fmt" },
      { label: "Decision", id: "D-fmt" },
    ],
  });
});

test("a file governed by an active decision but never edited still answers", async () => {
  await recordDecision(g(), { agent: "lead", text: "validate at the edge", why: "one place", paths: ["lib/validate.ts"], id: "D-val" });
  expect(await whyTrace(g(), "lib/validate.ts")).toEqual([
    expect.objectContaining({
      seq: 0,
      edits: 0,
      agent: "(no tracked edit)",
      decisionId: "D-val",
      decidedBy: "lead",
      path: ["lib/validate.ts", "(no tracked edit)", "(no task)", "validate at the edge"],
      nodes: [
        { label: "File", id: "lib/validate.ts" },
        { label: "Decision", id: "D-val" },
      ],
    }),
  ]);
});
