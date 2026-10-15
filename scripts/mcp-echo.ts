// Day-0 MCP probe (B1): a zero-dependency stdio MCP server with one tool, `sb_echo`.
// It answers whether Cursor and Claude Code can call a project MCP tool at all.
// Run: node scripts/mcp-echo.ts   (Node 22.18+ strips TypeScript types natively)
// Transport: one JSON-RPC message per line on stdin/stdout. Logs go to stderr and /tmp/sb-hooks.log.
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

type Message = { jsonrpc: "2.0"; id?: number | string; method?: string; params?: Record<string, unknown> };

const log = (line: string) => appendFileSync("/tmp/sb-hooks.log", `${new Date().toTimeString().slice(0, 8)} mcp ${line}\n`);
const send = (msg: object) => process.stdout.write(JSON.stringify(msg) + "\n");

const tool = {
  name: "sb_echo",
  description: "Switchboard Day-0 probe. Echoes the text back with a timestamp.",
  inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
};

function handle(msg: Message): object | undefined {
  switch (msg.method) {
    case "initialize":
      log(`initialize client=${JSON.stringify(msg.params?.clientInfo ?? {})}`);
      return {
        protocolVersion: (msg.params?.protocolVersion as string) ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "sb-echo", version: "0.0.0" },
      };
    case "tools/list":
      log("tools/list");
      return { tools: [tool] };
    case "tools/call": {
      const text = String((msg.params?.arguments as { text?: unknown })?.text ?? "");
      log(`tools/call ${msg.params?.name} text=${JSON.stringify(text)}`);
      return { content: [{ type: "text", text: `sb_echo: ${text} (at ${new Date().toISOString()})` }] };
    }
    case "ping":
      return {};
    default:
      return undefined;
  }
}

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  const msg = JSON.parse(line) as Message;
  if (msg.id === undefined) return; // notifications (e.g. notifications/initialized) need no reply
  const result = handle(msg);
  if (result) send({ jsonrpc: "2.0", id: msg.id, result });
  else send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
});
