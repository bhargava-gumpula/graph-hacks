import { expect, test } from "vitest";
import { CONNECT, cursorDeeplink } from "./ConnectPanel";

test("the Cursor link carries the MCP config as base64 JSON, without the name", () => {
  const url = new URL(cursorDeeplink());
  expect(url.protocol).toBe("cursor:");
  expect(url.host + url.pathname).toBe("anysphere.cursor-deeplink/mcp/install");
  expect(url.searchParams.get("name")).toBe(CONNECT.cursor.mcp.name);
  expect(JSON.parse(atob(url.searchParams.get("config")!))).toEqual(CONNECT.cursor.mcp.config);
});
