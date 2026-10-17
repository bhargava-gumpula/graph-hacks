#!/usr/bin/env node
// The stdio MCP server for the plugin and the npm package. Run directly, packages/mcp starts itself;
// `switchboard mcp` imports this file and calls start().
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createServer } from "../../mcp/src/index.js";
import { configure } from "./env.js";

configure(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());

export function start(): Promise<void> {
  return createServer().connect(new StdioServerTransport());
}
