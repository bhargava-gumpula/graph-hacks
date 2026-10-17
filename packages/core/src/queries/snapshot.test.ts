import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { parseRepo } from "../parser.js";
import { useTestGraph } from "../test-helpers.js";
import { claim } from "./claims.js";
import { loadParse } from "./loader.js";
import { graphSnapshot, listClaims } from "./snapshot.js";

const g = useTestGraph("sb_test_snapshot");

beforeAll(async () => {
  await loadParse(g(), parseRepo(join(import.meta.dirname, "../../../../demo-repo")));
  await g().query("MATCH (f:File {path: $p}) SET f.hub = true", { p: "lib/utils.ts" });
  await claim(g(), { agent: "A", paths: ["lib/crypto.ts"], taskId: "T1" });
});

test("snapshot has every demo-repo file, the 3-hop chain, and the claim", async () => {
  const snap = await graphSnapshot(g());
  const files = snap.nodes.filter((n) => n.kind === "file");
  const agents = snap.nodes.filter((n) => n.kind === "agent");
  expect(files).toHaveLength(35);
  expect(files.find((n) => n.id === "lib/utils.ts")?.hub).toBe(true);
  expect(agents.map((n) => n.id)).toContain("agent:A");
  expect(snap.edges).toContainEqual({
    source: "ui/LoginForm.tsx",
    target: "api/login.ts",
    kind: "IMPORTS",
  });
  expect(snap.edges).toContainEqual({
    source: "agent:A",
    target: "lib/crypto.ts",
    kind: "CLAIMS",
  });
  expect(files.find((n) => n.id === "lib/crypto.ts")?.claimedBy).toEqual(["A"]);
});

test("listClaims returns the active claim", async () => {
  const claims = await listClaims(g());
  expect(claims).toEqual([
    expect.objectContaining({ agent: "A", path: "lib/crypto.ts", taskId: "T1" }),
  ]);
});

test("nodes have exactly the docs/api.md fields", async () => {
  const snap = await graphSnapshot(g());
  expect(snap.nodes.find((n) => n.id === "lib/crypto.ts")).toEqual({
    id: "lib/crypto.ts",
    label: "crypto.ts",
    kind: "file",
    hub: false,
    claimedBy: ["A"],
  });
  expect(snap.nodes.find((n) => n.id === "agent:A")).toEqual({
    id: "agent:A",
    label: "A",
    kind: "agent",
    status: "active",
  });
  const keys = new Set(snap.edges.map((e) => `${e.kind} ${e.source} ${e.target}`));
  expect(keys.size).toBe(snap.edges.length);
});

test("expired claims are left out of the snapshot and listClaims", async () => {
  const later = Date.now() + 365 * 24 * 3600 * 1000;
  const snap = await graphSnapshot(g(), later);
  expect(snap.edges.filter((e) => e.kind === "CLAIMS")).toEqual([]);
  expect(snap.nodes.find((n) => n.id === "lib/crypto.ts")?.claimedBy).toEqual([]);
  expect(await listClaims(g(), later)).toEqual([]);
});
