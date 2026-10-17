import { describe, expect, test } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clientOptions, connect, dbUrl, locate, redactUrl } from "./graph.js";
import { useTestGraph } from "./test-helpers.js";

const graph = useTestGraph("sb_test_graph");

test("RETURN 1 comes back as a row keyed by the alias", async () => {
  expect(await graph().query("RETURN 1 AS one")).toEqual([{ one: 1 }]);
});

test("parameters are passed, not concatenated", async () => {
  const rows = await graph().query("RETURN $s AS s, $n AS n, $list AS list", { s: "a'b\"c", n: 2, list: ["x", "y"] });
  expect(rows).toEqual([{ s: "a'b\"c", n: 2, list: ["x", "y"] }]);
});

test("a write with no RETURN gives an empty array", async () => {
  expect(await graph().query("CREATE (:Probe {n: 1})")).toEqual([]);
  expect(await graph().roQuery("MATCH (p:Probe) RETURN p.n AS n")).toEqual([{ n: 1 }]);
});

test("roQuery rejects a CREATE", async () => {
  await expect(graph().roQuery("CREATE (:Nope {n: 1})")).rejects.toThrow(/read-only/);
});

test("the timeout option is enforced by the server", async () => {
  await expect(
    graph().roQuery("UNWIND range(1, 50000000) AS x RETURN count(x) AS n", undefined, { timeout: 1 }),
  ).rejects.toThrow(/timed out/);
});

test("a failing query keeps the server message and names the statement", async () => {
  const err = await graph().query("RETURN nope").catch((e: unknown) => e);
  expect(err).toBeInstanceOf(Error);
  expect((err as Error).message).toMatch(/^'nope' not defined \[query: RETURN nope\]$/);
  expect((err as Error).cause).toBeDefined();
});

test("connect to a closed port says where and what to do", async () => {
  await expect(connect({ url: "redis://localhost:1" })).rejects.toThrow(
    /Cannot connect to FalkorDB at redis:\/\/localhost:1\. Is it running\?.*ECONNREFUSED/,
  );
});

describe("cloud URLs", () => {
  const cloud = "rediss://default:s3cr%2Ft@r-abc.us-east-1.falkordb.cloud:61234";

  test("a rediss:// URL with credentials parses to host, port and TLS", () => {
    expect(locate(cloud)).toEqual({ host: "r-abc.us-east-1.falkordb.cloud", port: 61234, tls: true, where: "cloud" });
    expect(locate("redis://localhost:6379")).toEqual({ host: "localhost", port: 6379, tls: false, where: "local" });
    expect(locate("redis://10.0.0.5")).toEqual({ host: "10.0.0.5", port: 6379, tls: false, where: "remote" });
    expect(locate("falkors://h.example:7000").tls).toBe(true);
  });

  test("a bad URL or scheme fails without echoing the URL", () => {
    expect(() => locate("not a url s3cret")).toThrow(/not a valid URL/);
    expect(() => locate("not a url s3cret")).not.toThrow(/s3cret/);
    expect(() => locate("https://u:s3cret@h")).toThrow(/must start with redis/);
    expect(() => locate("https://u:s3cret@h")).not.toThrow(/s3cret/);
  });

  test("redactUrl hides the password and keeps the rest", () => {
    expect(redactUrl(cloud)).toBe("rediss://default:***@r-abc.us-east-1.falkordb.cloud:61234");
    expect(redactUrl("redis://localhost:6379")).toBe("redis://localhost:6379");
  });

  test("FALKORDB_USERNAME / FALKORDB_PASSWORD fill in only what the URL leaves out", () => {
    const env = { FALKORDB_USERNAME: "envuser", FALKORDB_PASSWORD: "envpass" };
    expect(clientOptions("rediss://h.falkordb.cloud:6380", env)).toEqual({
      url: "rediss://h.falkordb.cloud:6380",
      username: "envuser",
      password: "envpass",
    });
    expect(clientOptions(cloud, env)).toEqual({ url: cloud });
    expect(clientOptions("redis://localhost:6379", {})).toEqual({ url: "redis://localhost:6379" });
  });

  test("a failed connect never prints the password, from the URL or the env", async () => {
    const err = (await connect({ url: "rediss://default:s3cr%2Ft@127.0.0.1:1" }).catch((e: unknown) => e)) as Error;
    expect(err.message).toMatch(/^Cannot connect to FalkorDB at rediss:\/\/default:\*\*\*@127\.0\.0\.1:1\./);
    expect(err.message).not.toMatch(/s3cr/);
    expect(err.cause).toBeUndefined();

    process.env.FALKORDB_PASSWORD = "envs3cret";
    try {
      const err2 = (await connect({ url: "redis://127.0.0.1:1" }).catch((e: unknown) => e)) as Error;
      expect(err2.message).not.toMatch(/envs3cret/);
    } finally {
      delete process.env.FALKORDB_PASSWORD;
    }
  });

  test("a connected graph reports where it lives", () => {
    expect(graph().location).toMatchObject({ where: "local", tls: false });
  });
});

describe("SB_CLOUD and SB_ENV_FILE", () => {
  const cloud = { FALKORDB_CLOUD_HOST: "r-1.example.cloud", FALKORDB_CLOUD_PORT: "51809", FALKORDB_CLOUD_USERNAME: "falkordb", FALKORDB_CLOUD_PASSWORD: "p@ss/w:rd" };

  test("without SB_CLOUD it is FALKORDB_URL, else localhost", () => {
    expect(dbUrl({ ...cloud, FALKORDB_URL: "redis://h:1" })).toBe("redis://h:1");
    expect(dbUrl({ ...cloud })).toBe("redis://localhost:6379");
  });

  test("SB_CLOUD=1 composes an encoded redis:// URL that wins over FALKORDB_URL and redacts", () => {
    const url = dbUrl({ ...cloud, SB_CLOUD: "1", FALKORDB_URL: "redis://localhost:6379" });
    expect(url).toBe("redis://falkordb:p%40ss%2Fw%3Ard@r-1.example.cloud:51809");
    expect(new URL(url).password).toBe("p%40ss%2Fw%3Ard");
    expect(redactUrl(url)).toBe("redis://falkordb:***@r-1.example.cloud:51809");
    expect(locate(url)).toEqual({ host: "r-1.example.cloud", port: 51809, tls: false, where: "cloud" });
    expect(dbUrl({ ...cloud, SB_CLOUD: "1", FALKORDB_CLOUD_TLS: "1" })).toMatch(/^rediss:\/\//);
  });

  test("SB_CLOUD=1 with a key missing names the key, never a value", () => {
    expect(() => dbUrl({ SB_CLOUD: "1", FALKORDB_CLOUD_PASSWORD: "p@ss/w:rd" })).toThrow(/needs FALKORDB_CLOUD_HOST, FALKORDB_CLOUD_PORT, FALKORDB_CLOUD_USERNAME/);
    expect(() => dbUrl({ SB_CLOUD: "1", FALKORDB_CLOUD_PASSWORD: "p@ss/w:rd" })).not.toThrow(/p@ss/);
  });

  test("SB_ENV_FILE brings in only the FALKORDB_CLOUD_* keys, and the real env wins", () => {
    const file = join(mkdtempSync(join(tmpdir(), "sb-env-")), ".env");
    writeFileSync(file, "FALKORDB_URL=redis://localhost:6379\nSB_GRAPH=sb_other\nAPI_KEY=k\n" + Object.entries(cloud).map(([k, v]) => `${k}=${v}`).join("\n"));
    const env: NodeJS.ProcessEnv = { SB_ENV_FILE: file, SB_CLOUD: "1", FALKORDB_CLOUD_PORT: "7000" };
    expect(dbUrl(env)).toBe("redis://falkordb:p%40ss%2Fw%3Ard@r-1.example.cloud:7000");
    expect(env.FALKORDB_URL).toBeUndefined();
    expect(env.SB_GRAPH).toBeUndefined();
    expect(env.API_KEY).toBeUndefined();
    expect(() => dbUrl({ SB_ENV_FILE: join(file, "nope") })).toThrow(/SB_ENV_FILE=.* cannot be read/);
  });

  test("a failed cloud connect never prints the password, raw or encoded", async () => {
    const saved = { ...process.env };
    Object.assign(process.env, { ...cloud, FALKORDB_CLOUD_HOST: "127.0.0.1", FALKORDB_CLOUD_PORT: "1", SB_CLOUD: "1" });
    try {
      const err = (await connect({ graph: "sb_test_never" }).catch((e: unknown) => e)) as Error;
      expect(err.message).toMatch(/^Cannot connect to FalkorDB at redis:\/\/falkordb:\*\*\*@127\.0\.0\.1:1\./);
      expect(err.message).not.toMatch(/p@ss|p%40ss|w:rd/);
    } finally {
      for (const k of [...Object.keys(cloud), "SB_CLOUD"]) delete process.env[k];
      Object.assign(process.env, saved);
    }
  });
});
