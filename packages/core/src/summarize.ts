import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

/** F20: the only LLM call in Switchboard. Haiku, a short answer, and never on the critical path. */
export const SUMMARY_MODEL = "claude-haiku-5-5";
const MAX_OUTPUT_TOKENS = 200;
/** A briefing is at most a few dozen lines; this bounds the input cost if one isn't. */
const MAX_INPUT_CHARS = 8000;
const CACHE_SIZE = 100;

const PROMPT =
  "Summarize this Switchboard briefing for a coding agent in two plain-English sentences: " +
  "who is working near this area and what they must not break. Use only facts in the briefing.";

/** The one SDK method used, so tests can pass a fake instead of calling the API. */
export interface SummaryClient {
  messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
}

const cache = new Map<string, string>();

/**
 * Optional plain-English summary on top of a briefing. Returns null when
 * ANTHROPIC_API_KEY is unset, the text is empty, or anything goes wrong: the
 * graph text is the answer either way. Successful summaries are cached by a
 * hash of the briefing, so an unchanged briefing costs one call.
 */
export async function summarizeBrief(text: string, opts?: { client?: SummaryClient }): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY?.trim() || !text.trim()) return null;

  const key = createHash("sha256").update(text).digest("hex");
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  try {
    // Short timeout and one retry: a session-start hook must not hang on this.
    const client = opts?.client ?? new Anthropic({ timeout: 10_000, maxRetries: 1 });
    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // No thinking: the whole token budget goes to the two sentences.
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: `${PROMPT}\n\n${text.slice(0, MAX_INPUT_CHARS)}` }],
    });
    if (response.stop_reason === "refusal") return null;
    const summary = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!summary) return null;

    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, summary);
    return summary;
  } catch {
    return null;
  }
}
