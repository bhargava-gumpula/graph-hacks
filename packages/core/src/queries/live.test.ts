import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { claim } from "./claims.js";
import { findConflicts } from "./conflict.js";
import { codeGraphCounts, isRepoOf, loadParse, recordLiveEdit, updateFile, watchRepo, type FileUpdate } from "./loader.js";

const g = useTestGraph("sb_test_live");
const demoRepo = join(import.meta.dirname, "../../../../demo-repo");
const root = mkdtempSync(join(tmpdir(), "sb-live-"));
cpSync(demoRepo, root, { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));

const ABOUT = "ui/AboutPage.tsx";
const CRYPTO_IMPORT = 'import { hashPassword } from "../lib/crypto";\nexport const h = hashPassword;\n';

async function targets(path: string): Promise<string[]> {
  const rows = await g().roQuery("MATCH (:File {path: $path})-[:IMPORTS]->(t:File) RETURN t.path AS to ORDER BY to", { path });
  return rows.map((r) => String(r.to));
}

async function lastEvent(): Promise<Record<string, unknown> | undefined> {
  const [row] = await g().roQuery(
    "MATCH (e:Event) OPTIONAL MATCH (e)-[:ON]->(f:File) RETURN e.kind AS kind, e.payload AS payload, f.path AS on ORDER BY e.seq DESC LIMIT 1",
  );
  return row && { ...row, payload: JSON.parse(String(row.payload)) };
}

beforeAll(async () => {
  await loadParse(g(), parseRepo(root));
});

describe("updateFile", () => {
  test("an unchanged file is a no-op with no event", async () => {
    const u = await updateFile(g(), root, ABOUT);
    expect(u).toMatchObject({ status: "unchanged", added: [], removed: [], seq: null });
  });

  test("an added import is a new edge at once, a graph event, and a new conflict path", async () => {
    await claim(g(), { agent: "A", paths: ["lib/crypto.ts"] });
    expect(await findConflicts(g(), { agent: "B", paths: [ABOUT] })).toEqual([]);

    appendFileSync(join(root, ABOUT), CRYPTO_IMPORT);
    const u = await updateFile(g(), root, ABOUT, { agentId: "B" });
    expect(u).toMatchObject({ status: "updated", added: ["lib/crypto.ts"], removed: [] });
    expect(u.seq).toBeGreaterThan(0);
    expect(await targets(ABOUT)).toEqual(["lib/crypto.ts", "lib/utils.ts"]);
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 52 });
    expect(await lastEvent()).toEqual({
      kind: "graph",
      on: ABOUT,
      payload: { path: ABOUT, status: "updated", added: ["lib/crypto.ts"], removed: [] },
    });

    const [c] = await findConflicts(g(), { agent: "B", paths: [ABOUT] });
    expect(c).toMatchObject({ agent: "A", file: ABOUT, path: [ABOUT, "lib/crypto.ts"] });
  });

  test("a removed import drops the edge and the conflict", async () => {
    const text = readFileSync(join(root, ABOUT), "utf8");
    writeFileSync(join(root, ABOUT), text.replace(CRYPTO_IMPORT, ""));
    const u = await updateFile(g(), root, ABOUT);
    expect(u).toMatchObject({ status: "updated", added: [], removed: ["lib/crypto.ts"] });
    expect(await targets(ABOUT)).toEqual(["lib/utils.ts"]);
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
    expect(await findConflicts(g(), { agent: "B", paths: [ABOUT] })).toEqual([]);
  });

  test("a new file is added with its imports; a deleted file goes with its edges", async () => {
    const path = "ui/NewWidget.tsx";
    writeFileSync(join(root, path), 'import { login } from "../api/login";\nimport { slug } from "@lib/utils";\nexport const w = [login, slug];\n');
    expect(await updateFile(g(), root, path)).toMatchObject({ status: "created", added: ["api/login.ts", "lib/utils.ts"] });
    expect(await targets(path)).toEqual(["api/login.ts", "lib/utils.ts"]);
    expect(await codeGraphCounts(g())).toEqual({ files: 36, imports: 53 });

    unlinkSync(join(root, path));
    expect(await updateFile(g(), root, path)).toMatchObject({ status: "deleted", removed: ["api/login.ts", "lib/utils.ts"] });
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
    // The event has no ON link, which would MERGE the deleted file back.
    expect(await lastEvent()).toMatchObject({ kind: "graph", on: null, payload: { status: "deleted" } });
    expect(await updateFile(g(), root, path)).toMatchObject({ status: "unchanged" });
  });

  test("a file the parser skips, or a path outside the repo, is left alone", async () => {
    expect((await updateFile(g(), root, "README.md")).status).toBe("skipped");
    expect((await updateFile(g(), root, "../outside.ts")).status).toBe("skipped");
    expect((await updateFile(g(), root, "node_modules/x/index.ts")).status).toBe("skipped");
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
  });

  test("concurrent updates of one file apply once and end in the file's state", async () => {
    appendFileSync(join(root, ABOUT), CRYPTO_IMPORT);
    const all = await Promise.all(Array.from({ length: 5 }, () => updateFile(g(), root, ABOUT)));
    expect(all.filter((u) => u.status === "updated")).toHaveLength(1);
    expect(all.filter((u) => u.status === "unchanged")).toHaveLength(4);
    expect(await targets(ABOUT)).toEqual(["lib/crypto.ts", "lib/utils.ts"]);
  });

  test("a single-file update takes well under 50 ms", async () => {
    const text = readFileSync(join(root, ABOUT), "utf8");
    writeFileSync(join(root, ABOUT), text.replace(CRYPTO_IMPORT, ""));
    const u = await updateFile(g(), root, ABOUT);
    expect(u.status).toBe("updated");
    expect(u.ms).toBeLessThan(50);
  });
});

describe("recordLiveEdit", () => {
  test("an edit that deleted the file records no EDITED edge, so the File stays gone", async () => {
    const path = "ui/New.tsx";
    writeFileSync(join(root, path), 'import { slug } from "@lib/utils";\nexport const n = slug;\n');
    const made = await recordLiveEdit(g(), root, { agentId: "B", path });
    expect(made.graph).toMatchObject({ status: "created" });
    expect(await codeGraphCounts(g())).toEqual({ files: 36, imports: 52 });

    unlinkSync(join(root, path));
    const gone = await recordLiveEdit(g(), root, { agentId: "B", path });
    expect(gone.graph).toMatchObject({ status: "deleted", removed: ["lib/utils.ts"] });
    expect(gone.seq).toBe(gone.graph?.seq);
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
    const [row] = await g().roQuery("MATCH (f:File {path: $path}) RETURN count(f) AS n", { path });
    expect(Number(row?.n)).toBe(0);
  });

  test("with no repo it only records the edit", async () => {
    const e = await recordLiveEdit(g(), null, { agentId: "B", path: ABOUT });
    expect(e.graph).toBeNull();
    expect(e.seq).toBeGreaterThan(0);
    expect(await codeGraphCounts(g())).toEqual({ files: 35, imports: 51 });
  });
});

describe("isRepoOf", () => {
  test("tells the parsed repo from another directory", async () => {
    expect(await isRepoOf(g(), root)).toBe(true);
    expect(await isRepoOf(g(), tmpdir())).toBe(false);
  });

  test("a few files deleted while nothing watched still pass the default, not share 1", async () => {
    renameSync(join(root, ABOUT), join(root, "about.bak"));
    try {
      expect(await isRepoOf(g(), root)).toBe(true);
      expect(await isRepoOf(g(), root, 1)).toBe(false);
    } finally {
      renameSync(join(root, "about.bak"), join(root, ABOUT));
    }
  });

  describe("a team repo that shares lib/utils.ts with demo-repo", () => {
    const team = useTestGraph("sb_test_live_team");
    const teamRoot = mkdtempSync(join(tmpdir(), "sb-team-"));
    afterAll(() => rmSync(teamRoot, { recursive: true, force: true }));
    const files: Record<string, string> = {
      "lib/utils.ts": "export const cn = (...c: string[]) => c.join(' ');\n",
      "components/button.tsx": 'import { cn } from "../lib/utils";\nexport const Button = cn;\n',
      "components/card.tsx": 'import { cn } from "../lib/utils";\nexport const Card = cn;\n',
      "app/layout.tsx": 'import { cn } from "../lib/utils";\nexport const Layout = cn;\n',
      "app/page.tsx": 'import { Button } from "../components/button";\nimport { Card } from "../components/card";\nexport const Page = [Button, Card];\n',
    };

    beforeAll(async () => {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(teamRoot, path, ".."), { recursive: true });
        writeFileSync(join(teamRoot, path), text);
      }
      expect(await loadParse(team(), parseRepo(teamRoot))).toEqual({ files: 5, imports: 5 });
    });

    test("is its own repo and not demo-repo, for edits or for the demo", async () => {
      expect(await isRepoOf(team(), teamRoot)).toBe(true);
      expect(await isRepoOf(team(), demoRepo)).toBe(false);
      expect(await isRepoOf(team(), demoRepo, 1)).toBe(false);
    });

    test("an edit seen from a server on demo-repo leaves its imports alone", async () => {
      const liveRepo = (await isRepoOf(team(), demoRepo)) ? demoRepo : null;
      const e = await recordLiveEdit(team(), liveRepo, { agentId: "B", path: "components/button.tsx" });
      expect(e.graph).toBeNull();
      expect(await codeGraphCounts(team())).toEqual({ files: 5, imports: 5 });
    });
  });
});

describe("watchRepo", () => {
  test("a save on disk updates the graph without any hook", async () => {
    const seen: FileUpdate[] = [];
    const w = watchRepo(g(), root, { debounceMs: 50, onUpdate: (u) => seen.push(u) });
    try {
      await new Promise((r) => setTimeout(r, 200)); // let the watcher start
      appendFileSync(join(root, ABOUT), CRYPTO_IMPORT);
      writeFileSync(join(root, "notes.md"), "not source\n");
      const deadline = Date.now() + 5000;
      while (seen.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
      expect(seen).toEqual([expect.objectContaining({ path: ABOUT, status: "updated", added: ["lib/crypto.ts"] })]);
      expect(await targets(ABOUT)).toEqual(["lib/crypto.ts", "lib/utils.ts"]);
    } finally {
      w.close();
    }
  });
});
