// Getting a reply for a message through the Gemini Worker, falling back to the character's backup lines in characters.json.
import { config } from "~/lib/config";
import { pick } from "~/lib/util";
import { engine } from "./state";
import type { GeminiContext, Reply, Speaker } from "./types";

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function askGemini(c: Speaker, text: string, ctx: GeminiContext): Promise<string> {
  const history = (engine.histories[c.id] ||= []);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.TIMEOUT_MS);
  try {
    const res = await fetch(config.WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character: c.id,
        bond: ctx.bond,
        tod: ctx.tod,
        memory: ctx.memory || undefined,
        messages: [...history.slice(-config.HISTORY_TURNS), { role: "user", text }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new HttpError(res.status);
    const { reply } = (await res.json()) as { reply?: unknown };
    if (typeof reply !== "string" || !reply.trim()) throw new Error("empty reply");
    return reply.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gives { text, error }. `error` is true for a line that is not a real answer (the character asking
 * you to slow down), so the chat keeps it out of the context sent to Gemini.
 */
export async function getReply(c: Speaker, text: string, ctx: GeminiContext = {}): Promise<Reply> {
  const lang = ((engine.lastLang === "id" ? "id" : "en") as keyof Speaker["busy"]);
  if (config.WORKER_URL) {
    try {
      const reply = await askGemini(c, text, ctx);
      engine.failures = 0;
      return { text: reply };
    } catch (err) {
      if (err instanceof HttpError && err.status === 429) {
        // Sending too fast: the character says so in her own voice. Not an outage, so no failure count.
        return { text: pick(c.busy[lang] || c.busy.en), error: true };
      }
      engine.failures++;
      console.warn("Gemini unavailable, using backup replies:", (err as Error).message);
    }
  }
  const fallback = c.fallback?.[lang] || c.fallback?.en || ["..."];
  return { text: pick(fallback) };
}
