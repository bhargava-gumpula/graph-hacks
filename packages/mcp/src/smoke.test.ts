import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { claim, connect, ensureSchema, loadParse, parseRepo } from "@switchboard/core";
import { defaultAgent, projectDir } from "./index.js";

const root = join(import.meta.dirname, "../../..");
const tsx = join(root, "node_modules/.bin/tsx");
const GRAPH = `sb_test_mcp_${process.pid}`;

interface Rpc {
  id?: number;
  result?: {
    instructions?: string;
    tools?: { name: string; description?: string; outputSchema?: object }[];
    content?: { text?: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
  error?: { message?: string };
}

function start(): ChildProcess {
  return spawn(tsx, ["packages/mcp/src/index.ts"], {
    cwd: root,
    env: { ...process.env, SB_GRAPH: GRAPH, SB_AGENT: "smoke" },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

afterAll(async () => {
  const g = await connect({ graph: GRAPH });
  try {
    await g.drop();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("empty key")) throw err;
  }
  await g.close();
});

test("stdio server: tools list, register, status, claim conflict, bad input", async () => {
  const g = await connect({ graph: GRAPH });
  await ensureSchema(g);
  await loadParse(g, parseRepo(join(root, "demo-repo")));
  await claim(g, { agent: "A", paths: ["lib/crypto.ts"] });
  await g.close();

  const child = start();
  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const pending = new Map<number, (msg: Rpc) => void>();
  const rl = createInterface({ input: child.stdout! });
  rl.on("line", (line) => {
    let msg: Rpc;
    try {
      msg = JSON.parse(line) as Rpc;
    } catch {
      return;
    }
    if (msg.id === undefined) return;
    pending.get(msg.id)?.(msg);
  });

  const call = (id: number, method: string, params: object) =>
    new Promise<Rpc>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout ${method}\n${stderr}`)), 8000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });

  try {
    const init = await call(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0" },
    });
    expect(init.error, stderr).toBeUndefined();
    expect(init.result?.instructions).toContain("Call claim before editing any file");
    child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

    const listed = await call(2, "tools/list", {});
    expect(listed.error, stderr).toBeUndefined();
    const names = listed.result?.tools?.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "register_agent",
        "claim",
        "release",
        "heartbeat",
        "status",
        "record_decision",
        "record_lesson",
        "brief_me",
        "why",
        "blast_radius",
        "plan_task",
        "parallel_batches",
        "handoff",
        "search_memory",
        "hotspots",
      ]),
    );
    const schemaOf = (name: string) =>
      (listed.result?.tools?.find((tool) => tool.name === name) as { inputSchema?: { properties?: object } } | undefined)
        ?.inputSchema?.properties;
    expect(Object.keys(schemaOf("search_memory") ?? {})).toEqual(["words", "limit"]);
    expect(Object.keys(schemaOf("hotspots") ?? {})).toEqual(["days", "limit"]);

    for (const tool of listed.result?.tools ?? []) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.outputSchema, tool.name).toBeTruthy();
    }

    const registered = await call(3, "tools/call", {
      name: "register_agent",
      arguments: { kind: "cursor" },
    });
    expect(registered.error, stderr).toBeUndefined();
    expect(registered.result?.content?.[0]?.text).toContain("registered smoke");

    const snapshot = await call(4, "tools/call", { name: "status", arguments: {} });
    expect(snapshot.error, stderr).toBeUndefined();
    expect(snapshot.result?.content?.[0]?.text).toContain("smoke cursor active");
    expect(snapshot.result?.structuredContent?.agents).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "smoke", kind: "cursor" })]),
    );

    const blocked = await call(5, "tools/call", { name: "claim", arguments: { paths: ["ui/LoginForm.tsx"] } });
    expect(blocked.error, stderr).toBeUndefined();
    expect(blocked.result?.content?.[0]?.text).toContain(
      "UPSTREAM ui/LoginForm.tsx ← A via ui/LoginForm.tsx → api/login.ts → auth/session.ts → lib/crypto.ts",
    );
    expect(blocked.result?.structuredContent).toMatchObject({
      ok: false,
      conflicts: [{ agent: "A", hops: 3, claimed: "lib/crypto.ts" }],
    });

    const prefixed = await call(9, "tools/call", { name: "claim", arguments: { paths: ["demo-repo/ui/LoginForm.tsx"] } });
    expect(prefixed.result?.structuredContent).toMatchObject({ ok: false, conflicts: [{ file: "ui/LoginForm.tsx" }] });

    const free = await call(6, "tools/call", { name: "claim", arguments: { paths: ["ui/AboutPage.tsx"] } });
    expect(free.result?.structuredContent).toMatchObject({ ok: true, conflicts: [], unknown: [] });

    const fresh = await call(10, "tools/call", { name: "claim", arguments: { paths: ["ui/Brand.tsx"] } });
    expect(fresh.result?.structuredContent).toMatchObject({ ok: true, unknown: ["ui/Brand.tsx"] });
    expect(fresh.result?.content?.[0]?.text).toBe("WARNING not in the parsed graph, no dependency check: ui/Brand.tsx");

    const briefed = await call(11, "tools/call", { name: "brief_me", arguments: {} });
    expect(briefed.error ?? briefed.result?.isError, stderr).toBeFalsy();
    const b = briefed.result?.structuredContent?.brief as { files: string[]; events: unknown[] };
    expect(b.files.length).toBeGreaterThan(30);
    expect(b.events.length).toBeLessThanOrEqual(5);

    const spots = await call(12, "tools/call", { name: "hotspots", arguments: {} });
    expect(spots.result?.structuredContent?.hotspots).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "api/login.ts", refusals: 2 })]),
    );

    await call(13, "tools/call", {
      name: "record_decision",
      arguments: { text: "keep sessions short", why: "the auditors flagged idle tokens", affects: ["auth/session.ts"] },
    });
    const found = await call(14, "tools/call", { name: "search_memory", arguments: { words: "auditors" } });
    expect(found.result?.structuredContent?.hits).toEqual([
      expect.objectContaining({ kind: "decision", text: "keep sessions short", paths: ["auth/session.ts"] }),
    ]);

    const bad = await call(7, "tools/call", { name: "claim", arguments: { paths: [] } });
    expect(bad.error ?? bad.result?.isError).toBeTruthy();
  } finally {
    child.stdin?.end();
    child.kill();
  }
}, 20_000);

test("the default agent id comes from the configured checkout, not the server's working directory", () => {
  // Cursor may start the server anywhere; the hook names the checkout's branch, so the server must too.
  const repo = mkdtempSync(join(tmpdir(), "sb-mcp-id-"));
  const keys = ["SB_AGENT", "SB_EDITOR", "SB_PROJECT_DIR", "CLAUDE_PROJECT_DIR", "SB_ROOT"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    execFileSync("git", ["-C", repo, "init", "-q", "-b", "feature-x"]);
    execFileSync("git", ["-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init"]);
    for (const k of keys) delete process.env[k];
    process.env.SB_EDITOR = "cursor";
    process.env.SB_PROJECT_DIR = repo;
    expect(defaultAgent()).toBe("cursor@feature-x");
    process.env.SB_AGENT = "pinned";
    expect(defaultAgent()).toBe("pinned");
    // An unresolved ${workspaceFolder} is skipped for the next candidate.
    expect(projectDir({ SB_PROJECT_DIR: "${workspaceFolder}", SB_ROOT: repo })).toBe(repo);
    expect(projectDir({ SB_PROJECT_DIR: "${workspaceFolder}" })).toBeUndefined();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    rmSync(repo, { recursive: true, force: true });
  }
});
