import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { connect } from "@switchboard/core";

const root = join(import.meta.dirname, "../../..");
const tsx = join(root, "node_modules/.bin/tsx");
const GRAPH = "sb_test_mcp";

interface Rpc {
  id?: number;
  result?: { tools?: { name: string }[]; content?: { text?: string }[] };
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

test("stdio server lists claim, and register then status shows the agent", async () => {
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
    child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

    const listed = await call(2, "tools/list", {});
    expect(listed.error, stderr).toBeUndefined();
    const names = listed.result?.tools?.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["register_agent", "claim", "release", "heartbeat", "status"]));

    const registered = await call(3, "tools/call", {
      name: "register_agent",
      arguments: { kind: "cursor" },
    });
    expect(registered.error, stderr).toBeUndefined();
    expect(registered.result?.content?.[0]?.text).toContain("registered smoke");

    const snapshot = await call(4, "tools/call", { name: "status", arguments: {} });
    expect(snapshot.error, stderr).toBeUndefined();
    expect(snapshot.result?.content?.[0]?.text).toContain("smoke cursor active");
  } finally {
    child.stdin?.end();
    child.kill();
  }
}, 20_000);
