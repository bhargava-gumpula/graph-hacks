// End-to-end: the real server process on a test graph. CORS, per-visitor routing, the sweeper, and the demo guard.
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FalkorDB } from "falkordb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const NS = process.env.SB_TEST_NS ?? "";
const root = join(import.meta.dirname, "../../..");

const freePort = () =>
  new Promise<number>((done) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => done(port));
    });
  });

/** Start apps/server on `graph` and resolve once it listens. */
async function startServer(graph: string, env: Record<string, string>): Promise<{ base: string; proc: ChildProcess }> {
  const port = await freePort();
  const proc = spawn(process.execPath, ["--import", "tsx", "apps/server/src/index.ts"], {
    cwd: root,
    env: { ...process.env, SERVER_PORT: String(port), SB_GRAPH: graph, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  await new Promise<void>((ok, fail) => {
    const timer = setTimeout(() => fail(new Error(`server did not start:\n${log}`)), 30_000);
    const read = (b: Buffer) => {
      log += b.toString();
      if (log.includes("switchboard server")) {
        clearTimeout(timer);
        ok();
      }
    };
    proc.stdout!.on("data", read);
    proc.stderr!.on("data", read);
    proc.on("exit", () => fail(new Error(`server exited:\n${log}`)));
  });
  return { base: `http://127.0.0.1:${port}`, proc };
}

const stop = (proc: ChildProcess) =>
  new Promise<void>((done) => {
    if (proc.exitCode !== null) return done();
    proc.on("exit", () => done());
    proc.kill("SIGTERM");
  });

const cookieOf = (res: Response) => /sbv=([0-9a-f]{16})/.exec(res.headers.get("set-cookie") ?? "")?.[1];

let db: FalkorDB;
beforeAll(async () => {
  db = await FalkorDB.connect({ url: process.env.FALKORDB_URL ?? "redis://localhost:6379" });
});
afterAll(async () => {
  await db.close();
});
const dropAll = async (names: string[]) => {
  const have = await db.list();
  for (const n of names) if (have.includes(n)) await db.selectGraph(n).delete();
};

describe("public server", { timeout: 60_000 }, () => {
  const graph = `sb_test_srv_public${NS}`;
  const prefix = `sb_visit_${createHash("sha256").update(graph).digest("hex").slice(0, 4)}`;
  let base = "";
  let proc: ChildProcess;

  beforeAll(async () => {
    await dropAll([graph]);
    ({ base, proc } = await startServer(graph, { SB_PUBLIC: "1", SB_VISIT_IDLE_MS: "1500", SB_VISIT_SWEEP_MS: "500" }));
  }, 60_000);

  afterAll(async () => {
    await stop(proc);
    await dropAll([graph, ...(await db.list()).filter((n) => n.startsWith(prefix))]);
  });

  it("sends CORS headers to the site and localhost, not to other origins", async () => {
    const ask = (origin: string) => fetch(`${base}/api/cypher`, { headers: { origin } });
    expect((await ask("https://evil.example")).headers.get("access-control-allow-origin")).toBeNull();
    expect((await ask("https://switchboard-agents.xyz")).headers.get("access-control-allow-origin")).toBe("https://switchboard-agents.xyz");
    expect((await ask("http://localhost:5173")).headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const post = await fetch(`${base}/api/demo`, { method: "POST", headers: { origin: "https://evil.example" } });
    expect(post.status).toBe(403);
  });

  it("gives each visitor their own graph, and Play and claims stay in it", async () => {
    const first = await fetch(`${base}/api/health`);
    const a = cookieOf(first)!;
    expect(first.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(first.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
    const b = cookieOf(await fetch(`${base}/app`))!; // the page shell hands out the cookie too
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
    const as = { headers: { cookie: `sbv=${a}` } };
    const bs = { headers: { cookie: `sbv=${b}` } };
    const health = async (h: RequestInit) => (await (await fetch(`${base}/api/health`, h)).json()) as { graph: string; seq: number; visitor: string };
    const [ha, hb] = [await health(as), await health(bs)];
    expect(ha.graph).toBe(prefix + a);
    expect(hb.graph).toBe(prefix + b);
    expect(ha.visitor).toBe("own");

    // A claim by agent C in A's graph is not in B's.
    const claim = await fetch(`${base}/api/claims`, {
      method: "POST",
      headers: { ...as.headers, "content-type": "application/json" },
      body: JSON.stringify({ agent: "C", paths: ["ui/Footer.tsx"] }),
    });
    expect(await claim.json()).toMatchObject({ ok: true });
    const claimsOf = async (h: RequestInit) => ((await (await fetch(`${base}/api/claims`, h)).json()) as { agent: string }[]).map((c) => c.agent);
    expect(await claimsOf(as)).toContain("C");
    expect(await claimsOf(bs)).not.toContain("C");

    // Play resets A's graph only: B's feed and seq do not move.
    expect((await fetch(`${base}/api/demo`, { method: "POST", ...as })).status).toBe(200);
    expect(await claimsOf(as)).not.toContain("C");
    expect((await health(bs)).seq).toBe(hb.seq);
    expect((await health(as)).seq).toBeGreaterThan(ha.seq);
    const feedB = (await (await fetch(`${base}/api/feed?last=${hb.seq}`, bs)).json()) as unknown[];
    expect(feedB).toEqual([]);
  });

  it("keeps answering after its visitor connection to FalkorDB drops", async () => {
    const redis = await db.connection;
    const list = (await redis.sendCommand(["CLIENT", "LIST"])) as string;
    const ids = list
      .split("\n")
      .filter((line) => line.includes(` name=sb-visitors-${graph} `))
      .map((line) => /\bid=(\d+)/.exec(line)![1]);
    expect(ids.length).toBe(1);
    await redis.sendCommand(["CLIENT", "KILL", "ID", ids[0]]);
    await new Promise((r) => setTimeout(r, 500));
    expect(proc.exitCode).toBeNull();
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { visitor: string }).visitor).toBe("own"); // the client reconnected
  });

  it("sweeps idle visitor graphs and nothing else", async () => {
    const res = await fetch(`${base}/api/health`);
    const name = prefix + cookieOf(res)!;
    expect((await db.list()).includes(name)).toBe(true);
    await new Promise((r) => setTimeout(r, 2500));
    const left = await db.list();
    expect(left.includes(name)).toBe(false);
    expect(left.includes(graph)).toBe(true);
  });
});

describe("demo guard", { timeout: 60_000 }, () => {
  const graph = `sb_test_srv_repo${NS}`;
  let base = "";
  let proc: ChildProcess;

  beforeAll(async () => {
    await dropAll([graph]);
    const repo = mkdtempSync(join(tmpdir(), "sb-repo-"));
    writeFileSync(join(repo, "a.ts"), 'import { b } from "./b";\nexport const a = b;\n');
    writeFileSync(join(repo, "b.ts"), "export const b = 1;\n");
    ({ base, proc } = await startServer(graph, { SB_PUBLIC: "0", SB_REPO: repo }));
  }, 60_000);

  afterAll(async () => {
    await stop(proc);
    await dropAll([graph]);
  });

  it("never runs the demo on a graph that is not demo-repo's", async () => {
    const res = await fetch(`${base}/api/demo`, { method: "POST" });
    expect(res.status).toBe(409);
    const health = (await (await fetch(`${base}/api/health`)).json()) as { files: number; visitor?: string };
    expect(health.files).toBe(2);
    expect(health.visitor).toBeUndefined(); // no visitor copies off the public link
  });
});
