import { expect, test } from "vitest";
import { agentBadge, agentList, agentName, isScripted } from "./agents";

test("names agents per the agent-id contract", () => {
  expect(agentName("claude@main")).toBe("Claude Code · main");
  expect(agentName("cursor@main")).toBe("Cursor · main");
  expect(agentName("cursor@feat/login")).toBe("Cursor · feat/login");
  expect(agentName("A")).toBe("Agent A");
  expect(agentName("main")).toBe("main");
  expect(agentName("bot-7")).toBe("bot-7");
  expect(agentBadge("claude@main")).toBe("CC");
  expect(agentBadge("cursor@x")).toBe("Cu");
  expect(agentBadge("B")).toBe("B");
  expect(agentList(["cursor@main"])).toBe("Cursor · main");
  expect(agentList(["cursor@main", "B", "C"])).toBe("Cursor · main, Agent B and Agent C");
  expect(isScripted("A")).toBe(true);
  expect(isScripted("C")).toBe(false);
});
