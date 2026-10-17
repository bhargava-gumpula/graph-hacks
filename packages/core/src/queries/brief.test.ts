import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { brief, formatBrief, handoff, recordLesson } from "./brief.js";
import { claim } from "./claims.js";
import { recordEdit } from "./edits.js";
import { loadParse } from "./loader.js";
import { planTask, SET_TASK_STATUS } from "./schedule.js";
import { recordDecision } from "./why.js";

const g = useTestGraph("sb_test_brief");

// The demo chain: ui/LoginForm.tsx → api/login.ts → auth/session.ts → lib/crypto.ts; lib/utils.ts is the hub.
beforeAll(async () => {
  const graph = g();
  await loadParse(graph, parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  // Agent A works on T1 by claiming only; it never called plan_task.
  await claim(graph, { agent: "A", paths: ["auth/session.ts"], taskId: "T1", now: 1_000 });
  // k: 1 lets C past the 2-hop conflict check, so a nearby foreign claim exists.
  await claim(graph, { agent: "C", paths: ["ui/LoginForm.tsx"], taskId: "T9", now: 1_000, k: 1 });
  await recordEdit(graph, { agentId: "A", path: "auth/session.ts", taskId: "T1", now: 1_100 });
  await recordDecision(graph, { agent: "A", text: "session TTL is 15 min", why: "spec", paths: ["auth/session.ts"], id: "D0", now: 1_200 });
  await recordDecision(graph, { agent: "A", text: "use argon2, not bcrypt", why: "FIPS", paths: ["lib/crypto.ts"], id: "D1", now: 1_300 });
  await recordDecision(graph, { agent: "A", text: "utils stays pure", why: "hub", paths: ["lib/utils.ts"], id: "D-hub", now: 1_400 });
  await recordLesson(graph, { text: "run codegen before tsc", paths: ["api/login.ts"], id: "L1", now: 1_500 });
  await planTask(graph, { id: "T2", title: "login copy", paths: ["api/login.ts"] });
  await planTask(graph, { id: "T-done", paths: ["auth/session.ts"] });
  await graph.query(SET_TASK_STATUS, { id: "T-done", status: "done" });
  // B has not registered yet; the handoff must still land.
  await handoff(graph, { from: "A", to: "B", taskId: "T1", note: "session claim is mine, finish the TTL", now: 1_600 });
});

const NOW = 2_000;

test("a replacement agent briefed on a claim-only task hears everything, nearest first", async () => {
  const b = await brief(g(), { taskId: "T1", now: NOW });
  expect(b.files).toEqual(["auth/session.ts"]);
  expect(b.claims.map((c) => [c.agent, c.path, c.hops, c.taskId])).toEqual([
    ["A", "auth/session.ts", 0, "T1"],
    ["C", "ui/LoginForm.tsx", 2, "T9"],
  ]);
  expect(b.decisions.map((d) => [d.id, d.hops])).toEqual([
    ["D0", 0],
    ["D-hub", 1], // session.ts imports the hub directly
    ["D1", 1],
  ]);
  expect(b.lessons.map((l) => [l.text, l.path, l.hops])).toEqual([["run codegen before tsc", "api/login.ts", 1]]);
  expect(b.events.some((e) => e.kind === "edit" && e.agentId === "A")).toBe(true);
  expect(b.events.map((e) => e.seq)).toEqual([...b.events.map((e) => e.seq)].sort((x, y) => y - x));
  expect(b.tasks).toEqual([]); // T-done is done; T2 touches login, not session
  expect(b.handoff).toEqual({ note: "session claim is mine, finish the TTL", from: "A", to: "B" });
});

test("a hub is a neighbour like any file, but a briefing never reaches past it", async () => {
  // session.ts imports utils.ts (1 hop); AboutPage.tsx is reachable from session.ts only through utils.ts.
  await recordDecision(g(), { agent: "A", text: "about is static", why: "SEO", paths: ["ui/AboutPage.tsx"], id: "D-about", now: 1_450 });
  const ids = (await brief(g(), { taskId: "T1", now: NOW })).decisions.map((d) => d.id);
  expect(ids).toContain("D-hub");
  expect(ids).not.toContain("D-about");
  expect((await brief(g(), { paths: ["lib/utils.ts"], now: NOW })).decisions[0]).toMatchObject({ id: "D-hub", hops: 0 });
});

test("prefix '' briefs the whole repo; the file list is capped", async () => {
  const b = await brief(g(), { prefix: "", now: NOW });
  expect(b.files).toHaveLength(35);
  expect(formatBrief(b).split("\n")[0]).toMatch(/^Files: (\S+, ){7}\S+ \(\+27 more\)$/);
});

test("formatBrief lists each recently edited file once, with its newest edit", () => {
  const edit = (seq: number, path: string, agentId: string) => ({ seq, kind: "edit", path, agentId });
  const text = formatBrief({
    files: ["a"],
    claims: [],
    decisions: [],
    lessons: [],
    tasks: [],
    handoff: null,
    events: [edit(9, "a", "B"), { seq: 8, kind: "claim", path: "a", agentId: "B" }, edit(7, "a", "A"), edit(5, "b", "A")],
  });
  expect(text.split("\n").filter((l) => l.startsWith("Recent edit"))).toEqual([
    "Recent edit: a by B (#9)",
    "Recent edit: b by A (#5)",
  ]);
});

test("a prefix area lists its open tasks", async () => {
  const b = await brief(g(), { prefix: "api/login", now: NOW });
  expect(b.files).toEqual(["api/login.ts"]);
  expect(b.tasks).toEqual([{ id: "T2", title: "login copy" }]);
  expect(b.lessons[0]).toMatchObject({ id: "L1", hops: 0 });
});

test("expired claims drop out", async () => {
  const later = Date.now() + 365 * 86_400_000;
  expect((await brief(g(), { taskId: "T1", now: later })).claims).toEqual([]);
});

test("an unknown area is an empty briefing, not an error", async () => {
  const b = await brief(g(), { taskId: "nope" });
  expect(b).toEqual({ files: [], claims: [], decisions: [], lessons: [], events: [], tasks: [], handoff: null, related: [] });
  expect(formatBrief(b)).toBe("Files: (none)");
});

test("formatBrief reads top to bottom: handoff, claims, decisions, lessons, edits", async () => {
  const text = formatBrief(await brief(g(), { taskId: "T1", now: NOW }));
  expect(text.split("\n")).toEqual([
    "Files: auth/session.ts",
    "Handoff A → B: session claim is mine, finish the TTL",
    "Claim: A holds auth/session.ts (here, task T1)",
    "Claim: C holds ui/LoginForm.tsx (2 hops away, task T9)",
    "Decision: session TTL is 15 min (auth/session.ts, here)",
    "Decision: utils stays pure (lib/utils.ts, 1 hop away)",
    "Decision: use argon2, not bcrypt (lib/crypto.ts, 1 hop away)",
    "Lesson: run codegen before tsc (api/login.ts, 1 hop away)",
    expect.stringMatching(/^Recent edit: auth\/session.ts by A \(#\d+\)$/),
  ]);
});

test("with the agent's own words, full-text matches from anywhere join as related", async () => {
  // D-about sits past the hub, out of the import neighbourhood; its words still find it.
  const b = await brief(g(), { taskId: "T1", text: "make the about page static", now: NOW });
  expect(b.decisions.map((d) => d.id)).not.toContain("D-about");
  expect(b.related?.map((r) => r.id)).toEqual(["D-about"]);
  expect(formatBrief(b)).toContain("Related decision: about is static. Why: SEO (ui/AboutPage.tsx)");
  // Words that match a decision already listed add nothing.
  expect((await brief(g(), { taskId: "T1", text: "session TTL", now: NOW })).related).toEqual([]);
  expect((await brief(g(), { taskId: "T1", now: NOW })).related).toEqual([]);
});

test("related never lists a superseded decision next to the one that replaced it", async () => {
  await recordDecision(g(), { agent: "A", text: "session ttl 30m for mobile", why: "logouts", paths: ["auth/session.ts"], id: "D-ttl-old", now: 1_700 });
  await recordDecision(g(), { agent: "A", text: "session ttl 60m for mobile", why: "fewer logins", paths: ["auth/session.ts"], id: "D-ttl-new", supersedes: ["D-ttl-old"], now: 1_800 });
  const b = await brief(g(), { prefix: "ui/AboutPage", text: "session ttl mobile", now: NOW });
  expect(b.related?.map((r) => r.id)).toContain("D-ttl-new");
  expect(b.related?.map((r) => r.id)).not.toContain("D-ttl-old");
  expect(formatBrief(b)).not.toContain("30m");
});
