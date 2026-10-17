import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { agentId } from "../agent-id.js";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { claim, release } from "./claims.js";
import { loadParse } from "./loader.js";
import { formatNotices, recordWaits, waitNotices } from "./waits.js";

const g = useTestGraph("sb_test_waits");
const repo = mkdtempSync(join(tmpdir(), "sb-waits-"));
const saved = { agent: process.env.SB_AGENT, editor: process.env.SB_EDITOR };
let CLAUDE = "";
let CURSOR = "";
const SESSION = "auth/session.ts";
const LOGIN = "ui/LoginForm.tsx";

beforeAll(async () => {
  await loadParse(g(), parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  delete process.env.SB_AGENT;
  delete process.env.SB_EDITOR;
  execFileSync("git", ["-C", repo, "init", "-q", "-b", "main"]);
  execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "x"]);
  CLAUDE = agentId(repo, "claude");
  CURSOR = agentId(repo, "cursor");
});
afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  if (saved.agent !== undefined) process.env.SB_AGENT = saved.agent;
  if (saved.editor !== undefined) process.env.SB_EDITOR = saved.editor;
});
beforeEach(async () => {
  await release(g(), { agent: CLAUDE });
  await release(g(), { agent: CURSOR });
});

const events = async (kind: string) =>
  (await g().roQuery("MATCH (e:Event {kind: $kind}) RETURN e.payload AS p ORDER BY e.seq", { kind })).map((r) => JSON.parse(String(r.p)));
const waitEdges = async () =>
  (await g().roQuery("MATCH (a:Agent)-[w:WAITS_FOR]->(f:File) RETURN a.id AS a, f.path AS f, w.path AS wanted")).map((r) => [r.a, r.f, r.wanted]);

describe("waits", () => {
  test("Claude Code and Cursor on one branch get two ids and conflict on the demo path", async () => {
    expect([CLAUDE, CURSOR]).toEqual(["claude@main", "cursor@main"]);
    expect((await claim(g(), { agent: CLAUDE, paths: [SESSION] })).ok).toBe(true);
    const res = await claim(g(), { agent: CURSOR, paths: [LOGIN] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.conflicts[0]).toMatchObject({ agent: CLAUDE, claimed: SESSION, path: [LOGIN, "api/login.ts", SESSION] });
    // The conflict event links every file on the refused path.
    const via = await g().roQuery("MATCH (e:Event {seq: $seq})-[:VIA]->(f:File) RETURN f.path AS p ORDER BY p", { seq: res.seq });
    expect(via.map((r) => r.p)).toEqual(["api/login.ts", SESSION, LOGIN]);
  });

  test("refusal → wait; holder told once; release → free event; waiter told; edge removed", async () => {
    await claim(g(), { agent: CLAUDE, paths: [SESSION] });
    const res = await claim(g(), { agent: CURSOR, paths: [LOGIN] });
    if (res.ok) throw new Error("expected a conflict");
    const waitsBefore = (await events("wait")).length;
    expect(await recordWaits(g(), { agent: CURSOR, conflicts: res.conflicts })).toBe(1);
    // A second refusal on the same file is the same wait: no new event.
    expect(await recordWaits(g(), { agent: CURSOR, conflicts: res.conflicts })).toBe(0);
    expect((await events("wait")).slice(waitsBefore)).toEqual([
      { agent: CURSOR, path: SESSION, holder: CLAUDE, via: [LOGIN, "api/login.ts", SESSION] },
    ]);
    expect(await waitEdges()).toEqual([[CURSOR, SESSION, LOGIN]]);

    const held = await waitNotices(g(), CLAUDE);
    expect(held.waiting).toEqual([{ waiter: CURSOR, held: SESSION, wanted: LOGIN, via: [LOGIN, "api/login.ts", SESSION] }]);
    expect(formatNotices(held, CLAUDE)).toBe(
      `cursor@main is waiting on ${SESSION}: it wants ${LOGIN}, 2 imports from your claim. ` +
        `Release it when you're done: switchboard release ${SESSION} --agent claude@main`,
    );
    expect((await waitNotices(g(), CLAUDE)).waiting).toEqual([]);
    expect(await waitNotices(g(), CURSOR)).toEqual({ waiting: [], freed: [] });

    const freesBefore = (await events("free")).length;
    await release(g(), { agent: CLAUDE });
    expect((await events("free")).slice(freesBefore)).toEqual([{ path: SESSION, waiters: [CURSOR] }]);

    const freed = await waitNotices(g(), CURSOR);
    expect(freed.freed).toEqual([{ held: SESSION, wanted: LOGIN }]);
    expect(formatNotices(freed, CURSOR)).toBe(`${SESSION} is free now; you can retry ${LOGIN}.`);
    expect(await waitEdges()).toEqual([]);
    // No second `free` for the same release.
    expect((await events("free")).length).toBe(freesBefore + 1);
    expect((await claim(g(), { agent: CURSOR, paths: [LOGIN] })).ok).toBe(true);
  });

  test("an expired claim is noticed on the waiter's next check", async () => {
    const t0 = Date.now();
    await claim(g(), { agent: CLAUDE, paths: [SESSION], ttlMs: 1000, now: t0 });
    const res = await claim(g(), { agent: CURSOR, paths: [LOGIN], now: t0 + 10 });
    if (res.ok) throw new Error("expected a conflict");
    await recordWaits(g(), { agent: CURSOR, conflicts: res.conflicts, now: t0 + 10 });
    const freesBefore = (await events("free")).length;
    const n = await waitNotices(g(), CURSOR, t0 + 5000);
    expect(n.freed).toEqual([{ held: SESSION, wanted: LOGIN }]);
    expect((await events("free")).slice(freesBefore)).toEqual([{ path: SESSION, waiters: [CURSOR] }]);
    expect(await waitEdges()).toEqual([]);
  });

  test("ending a session drops the agent's own waits", async () => {
    await claim(g(), { agent: CLAUDE, paths: [SESSION] });
    const res = await claim(g(), { agent: CURSOR, paths: [LOGIN] });
    if (res.ok) throw new Error("expected a conflict");
    await recordWaits(g(), { agent: CURSOR, conflicts: res.conflicts });
    await release(g(), { agent: CURSOR });
    expect(await waitEdges()).toEqual([]);
  });
});
