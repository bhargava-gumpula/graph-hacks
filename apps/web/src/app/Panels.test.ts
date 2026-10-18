import { expect, test } from "vitest";
import type { FeedItem } from "./api";
import { waitStates } from "./Panels";

const ev = (seq: number, kind: string, agentId: string | null, payload: unknown = null): FeedItem => ({ seq, kind, at: seq, payload, agentId, onLabel: null, onKey: null });

test("a freed waiter whose session ends is neither waiting nor blocked", () => {
  const story = [
    ev(1, "claim", "claude@main"),
    ev(2, "conflict", "cursor@main"),
    ev(3, "wait", "cursor@main", { agent: "cursor@main", path: "auth/session.ts", holder: "claude@main" }),
  ];
  expect(waitStates(story).get("cursor@main")).toEqual({ kind: "waiting", path: "auth/session.ts", holder: "claude@main" });
  const freed = [...story, ev(4, "release", "claude@main"), ev(5, "free", null, { path: "auth/session.ts", waiters: ["cursor@main"] })];
  expect(waitStates(freed).get("cursor@main")).toEqual({ kind: "free", path: "auth/session.ts" });
  // Its session ends: a release. The map still holds the agent (null), so the panel shows no old refusal.
  const ended = waitStates([...freed, ev(6, "release", "cursor@main")]);
  expect(ended.has("cursor@main")).toBe(true);
  expect(ended.get("cursor@main")).toBeNull();
  // Refused again after the free: no entry, so the refusal shows.
  expect(waitStates([...freed, ev(6, "conflict", "cursor@main")]).has("cursor@main")).toBe(false);
});
