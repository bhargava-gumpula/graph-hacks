import { describe, expect, test } from "vitest";
import { clientOptions, connect, locate, redactUrl } from "./graph.js";
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
    const err = await connect({ url: "rediss://default:s3cr%2Ft@127.0.0.1:1" }).catch((e: unknown) => e as Error);
    expect(err.message).toMatch(/^Cannot connect to FalkorDB at rediss:\/\/default:\*\*\*@127\.0\.0\.1:1\./);
    expect(err.message).not.toMatch(/s3cr/);
    expect(err.cause).toBeUndefined();

    process.env.FALKORDB_PASSWORD = "envs3cret";
    try {
      const err2 = await connect({ url: "redis://127.0.0.1:1" }).catch((e: unknown) => e as Error);
      expect(err2.message).not.toMatch(/envs3cret/);
    } finally {
      delete process.env.FALKORDB_PASSWORD;
    }
  });

  test("a connected graph reports where it lives", () => {
    expect(graph().location).toMatchObject({ where: "local", tls: false });
  });
});
