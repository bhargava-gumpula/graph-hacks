// Every worktree of a repo shares one graph. Updates from one worktree must never delete another's files.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { claim, release } from "./claims.js";
import { loadParse, staleFiles, updateRepo } from "./loader.js";

const g = useTestGraph("sb_test_worktrees");
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "sb-wt-")));
const X = join(tmp, "x");
const Y = join(tmp, "y");
const git = (...args: string[]) => execFileSync("git", ["-C", X, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { stdio: "ignore" });

beforeAll(() => {
  cpSync(join(import.meta.dirname, "../../../../demo-repo"), X, { recursive: true });
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-qm", "init");
  git("worktree", "add", "-q", "-b", "y", Y);
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const node = async (path: string) =>
  (
    await g().roQuery(
      "MATCH (f:File {path: $path}) OPTIONAL MATCH (a:Agent)-[:CLAIMS]->(f) OPTIONAL MATCH (f)-[:IMPORTS]->(t:File) RETURN f.hash IS NOT NULL AS parsed, collect(DISTINCT a.id) AS holders, collect(DISTINCT t.path) AS imports",
      { path },
    )
  )[0];

test("staleFiles is null on a graph with no parsed file", async () => {
  expect(await staleFiles(g(), X)).toBeNull();
});

test("a worktree's new file keeps its node, claim and imports through every update from the other worktree", async () => {
  await updateRepo(g(), X); // empty graph: the first load, which deletes nothing
  const files = async () => (await g().roQuery("MATCH (f:File) WHERE f.hash IS NOT NULL RETURN count(f) AS n"))[0]?.n;
  expect(await files()).toBe(35);

  // Worktree Y's agent claims and writes a new file that imports auth/session.ts.
  expect((await claim(g(), { agent: "claude@y", paths: ["ui/New.tsx"] })).ok).toBe(true);
  writeFileSync(join(Y, "ui/New.tsx"), 'import { openSession } from "../auth/session";\nexport const open = openSession;\n');
  expect((await updateRepo(g(), Y, ["ui/New.tsx"])).updates[0]).toMatchObject({ status: "created", added: ["auth/session.ts"] });

  // Worktree X has no ui/New.tsx. Its edits, its session-start check and a first load from it delete nothing.
  writeFileSync(join(X, "ui/Footer.tsx"), "export const Footer = () => null;\n");
  await updateRepo(g(), X, ["ui/Footer.tsx"]);
  expect((await updateRepo(g(), X)).updates.map((u) => u.path)).toEqual([]);
  await loadParse(g(), parseRepo(X), { deleteStale: false });
  expect(await node("ui/New.tsx")).toEqual({ parsed: true, holders: ["claude@y"], imports: ["auth/session.ts"] });
  expect(await files()).toBe(36);

  // So X's agent is refused auth/session.ts through Y's new file.
  const res = await claim(g(), { agent: "claude@main", paths: ["auth/session.ts"] });
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.conflicts).toContainEqual(expect.objectContaining({ type: "DOWNSTREAM", claimed: "ui/New.tsx", agent: "claude@y" }));

  // The agent that deletes a file removes exactly that node.
  rmSync(join(Y, "ui/New.tsx"));
  expect((await updateRepo(g(), Y, ["ui/New.tsx"])).updates[0]?.status).toBe("deleted");
  expect(await files()).toBe(35);
  await release(g(), { agent: "claude@y" });
});

test("staleFiles: new and changed source files of this checkout, none someone claims", async () => {
  writeFileSync(join(X, "ui/Header.tsx"), "export const Header = () => 'changed';\n");
  writeFileSync(join(X, "ui/Extra.tsx"), "export const Extra = 1;\n");
  writeFileSync(join(X, "notes.md"), "not source\n");
  expect(await staleFiles(g(), X)).toEqual(["ui/Extra.tsx", "ui/Header.tsx"]);
  expect((await claim(g(), { agent: "cursor@main", paths: ["ui/Header.tsx"] })).ok).toBe(true);
  expect(await staleFiles(g(), X)).toEqual(["ui/Extra.tsx"]);
  await release(g(), { agent: "cursor@main" });
});

test("only an explicit full parse deletes files it does not find (documented: run it from the main checkout)", async () => {
  writeFileSync(join(Y, "ui/Only.tsx"), "export const only = 1;\n");
  await updateRepo(g(), Y, ["ui/Only.tsx"]);
  expect((await node("ui/Only.tsx"))?.parsed).toBe(true);
  await loadParse(g(), parseRepo(X));
  expect(await node("ui/Only.tsx")).toBeUndefined();
});
