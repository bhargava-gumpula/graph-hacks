import { expect, test } from "vitest";
import { CONNECT, cursorDeeplink } from "./ConnectPanel";

test("the Cursor link carries the MCP config as base64 JSON, without the name", () => {
  const url = new URL(cursorDeeplink());
  expect(url.protocol).toBe("cursor:");
  expect(url.host + url.pathname).toBe("anysphere.cursor-deeplink/mcp/install");
  expect(url.searchParams.get("name")).toBe(CONNECT.cursor.mcp.name);
  expect(JSON.parse(atob(url.searchParams.get("config")!))).toEqual({
    command: "npx",
    args: ["-y", "switchboard-agents", "mcp"],
    env: { SB_EDITOR: "cursor", SB_PROJECT_DIR: "${workspaceFolder}" },
  });
});

test("the Claude Code install names the marketplace in .claude-plugin/marketplace.json", () => {
  expect(CONNECT.claude.steps.map((s) => s.cmd)).toEqual([
    "/plugin marketplace add bhargava-gumpula/graph-hacks",
    "/plugin install switchboard@switchboard",
  ]);
});
