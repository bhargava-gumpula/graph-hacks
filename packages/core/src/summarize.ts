/**
 * Optional plain-English line on a briefing. No API key means no summary:
 * the graph text is the answer either way.
 */
export async function summarizeBrief(text: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || !text.trim()) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `Summarize this Switchboard briefing in two sentences. Do not add facts.\n\n${text.slice(0, 4000)}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: { type?: string; text?: string }[] };
    return body.content?.find((block) => block.type === "text")?.text ?? null;
  } catch {
    return null;
  }
}
