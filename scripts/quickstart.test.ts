import { expect, test } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { buildPlan, parseArgs, redactUrl } from "./quickstart.mjs";

type Step = { do: string; say: string };
const base = {
  node: "22.12.0",
  falkorUrl: "redis://localhost:6379",
  falkorUp: true,
  docker: "not needed",
  hasDeps: true,
  hasEnv: true,
  port: 8787,
  graph: "sb_demo",
  serverUp: false,
  open: true,
};
const actions = (state: object) => (buildPlan({ ...base, ...state }) as Step[]).map((s) => s.do).filter((d) => d !== "none");

test("parseArgs knows --dry-run, --no-open and --help, and rejects anything else", () => {
  expect(parseArgs([])).toEqual({ dryRun: false, open: true, help: false });
  expect(parseArgs(["--dry-run", "--no-open"])).toEqual({ dryRun: true, open: false, help: false });
  expect(parseArgs(["-h"]).help).toBe(true);
  expect(() => parseArgs(["--port", "1"])).toThrow(/unknown option --port/);
});

test("a FalkorDB that already answers is reused: no docker step", () => {
  const plan = buildPlan(base) as Step[];
  expect(plan[0]!.say).toBe("FalkorDB already answers at redis://localhost:6379: reuse it (no docker command)");
  expect(actions({})).toEqual(["parse", "build", "server", "open"]);
  expect(plan.at(-1)!.say).toBe("open http://localhost:8787/app?tour=1");
});

test("a fresh machine runs every step", () => {
  expect(actions({ falkorUp: false, docker: "ok", hasDeps: false, hasEnv: false })).toEqual([
    "docker",
    "install",
    "env",
    "parse",
    "build",
    "server",
    "open",
  ]);
});

test("a second run with the server up only opens the page", () => {
  expect(actions({ serverUp: true })).toEqual(["open"]);
  expect(actions({ serverUp: true, open: false })).toEqual([]);
});

test("friendly errors carry the fix", () => {
  expect(() => buildPlan({ ...base, node: "20.11.0" })).toThrow(/Node 22 or newer is needed, you have 20\.11\.0/);
  expect(() => buildPlan({ ...base, falkorUp: false, docker: "stopped" })).toThrow(/Docker isn't running: start Docker Desktop or OrbStack/);
  expect(() => buildPlan({ ...base, falkorUp: false, docker: "missing" })).toThrow(/Docker isn't installed/);
  expect(() => buildPlan({ ...base, falkorUp: false, falkorUrl: "redis://db.example:6379" })).toThrow(/Nothing answers at FALKORDB_URL/);
  expect(() => buildPlan({ ...base, falkorUp: false, falkorUrl: "redis://localhost:6390" })).toThrow(/serves FalkorDB on 6379/);
});

test("no message prints the FalkorDB password", () => {
  const cloud = "rediss://default:Secret789@r-nothere.invalid:6380";
  expect(redactUrl(cloud)).toBe("rediss://default:***@r-nothere.invalid:6380");
  expect(redactUrl("redis://localhost:6379")).toBe("redis://localhost:6379");
  expect(redactUrl("not a url")).toBe("(invalid URL)");
  const messages = [
    () => buildPlan({ ...base, falkorUrl: cloud })[0].say,
    () => buildPlan({ ...base, falkorUp: false, falkorUrl: cloud }),
    () => buildPlan({ ...base, falkorUp: false, falkorUrl: "redis://:Secret789@localhost:6390" }),
    () => buildPlan({ ...base, falkorUp: false, docker: "ok", falkorUrl: "redis://:Secret789@localhost:6379" })[0].say,
  ].map((f) => {
    try {
      return String(f());
    } catch (err) {
      return (err as Error).message;
    }
  });
  expect(messages.join("\n")).not.toContain("Secret789");
  expect(messages[1]).toContain("FALKORDB_URL=rediss://default:***@r-nothere.invalid:6380");
});
