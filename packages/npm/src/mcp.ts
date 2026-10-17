#!/usr/bin/env node
// The stdio MCP server for the plugin and the npm package. Run directly, packages/mcp starts itself;
// `switchboard mcp` imports this file and calls start().
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createServer, projectDir } from "../../mcp/src/index.js";
import { configure } from "./env.js";

// Cursor fills SB_PROJECT_DIR from ${workspaceFolder}; a client that leaves the placeholder unresolved gets cwd.
configure(projectDir() ?? process.cwd());

export function start(): Promise<void> {
  return createServer().connect(new StdioServerTransport());
}
