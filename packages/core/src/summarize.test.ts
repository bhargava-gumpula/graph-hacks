import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SUMMARY_MODEL, summarizeBrief, type SummaryClient } from "./summarize.js";

// No test here reaches the real API: every call passes a fake client, or returns before making one.

function fake(reply: Partial<Anthropic.Message> | Error) {
  const create = vi.fn(async (params: Anthropic.MessageCreateParamsNonStreaming) => {
    void params;
    if (reply instanceof Error) throw reply;
    return { stop_reason: "end_turn", content: [], ...reply } as Anthropic.Message;
  });
  return { client: { messages: { create } } satisfies SummaryClient, create };
}

const text = (t: string) => ({ content: [{ type: "text", text: t, citations: null }] as Anthropic.ContentBlock[] });

beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "test-key"));
afterEach(() => vi.unstubAllEnvs());

test("no API key means no summary and no call", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  const { client, create } = fake(text("x"));
  expect(await summarizeBrief("Files: a.ts", { client })).toBeNull();
  expect(create).not.toHaveBeenCalled();
});

test("empty briefing means no call", async () => {
  const { client, create } = fake(text("x"));
  expect(await summarizeBrief("   ", { client })).toBeNull();
  expect(create).not.toHaveBeenCalled();
});

test("asks Haiku with a token cap and no thinking, then caches by briefing", async () => {
  const { client, create } = fake(text(" A holds session.ts. Do not touch login. "));
  const brief = `Files: auth/session.ts ${Math.random()}`;
  expect(await summarizeBrief(brief, { client })).toBe("A holds session.ts. Do not touch login.");
  expect(await summarizeBrief(brief, { client })).toBe("A holds session.ts. Do not touch login.");
  expect(create).toHaveBeenCalledTimes(1);
  expect(create.mock.calls[0]![0]).toMatchObject({
    model: SUMMARY_MODEL,
    max_tokens: 200,
    thinking: { type: "disabled" },
  });
});

test("any error degrades to no summary, and is not cached", async () => {
  const brief = `Files: x.ts ${Math.random()}`;
  expect(await summarizeBrief(brief, fake(new Error("rate limited")))).toBeNull();
  const { client } = fake(text("ok"));
  expect(await summarizeBrief(brief, { client })).toBe("ok");
});

test("a refusal or an empty reply is no summary", async () => {
  expect(await summarizeBrief(`a ${Math.random()}`, fake({ stop_reason: "refusal", ...text("no") }))).toBeNull();
  expect(await summarizeBrief(`b ${Math.random()}`, fake(text("  ")))).toBeNull();
});
