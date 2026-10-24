// Getting a reply for a message.
// Order: local safety rule, then Gemini (through the Worker), then backup replies.

import { state } from "./state.js";
import { findReply } from "./rules.js";
import { pick } from "./util.js";
import { load, levelOf } from "./games/progress.js";

// Rules at or above this priority (the crisis/safety rules) are never handed to Gemini.
const SAFETY_PRIORITY = 100;

async function askGemini(c, text) {
  const cfg = window.POCO_CONFIG;
  const history = (state.histories[c.id] ||= []);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.TIMEOUT_MS);
  try {
    const res = await fetch(cfg.WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character: c.id,
        bond: levelOf(load().bond[c.id] || 0), // how close the player is to this ghost (1 to 10); the Worker lets it colour her tone
        messages: [...history.slice(-cfg.HISTORY_TURNS), { role: "user", text }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    const { reply } = await res.json();
    if (typeof reply !== "string" || !reply.trim()) throw new Error("empty reply");
    return reply.trim();
  } finally {
    clearTimeout(timer);
  }
}

// Gives { text, error }. `error` is true for a line that is not a real answer (the character asking
// you to slow down), so the chat keeps it out of the context sent to Gemini.
export async function getReply(c, text) {
  const { manifest } = state;

  // The local lookup should never block a reply: retry once, then carry on without it.
  let local;
  for (let attempt = 0; attempt < 2 && !local; attempt++) {
    try {
      local = await findReply(text);
    } catch (err) {
      console.warn("Local rule lookup failed:", err.message);
    }
  }
  local ||= { reply: pick(manifest.languages[state.lastLang || manifest.defaultLang].fallback), priority: -1 };
  if (local.lang) state.lastLang = local.lang;

  if (local.priority >= SAFETY_PRIORITY) return { text: local.reply };

  let reply;
  if (window.POCO_CONFIG.WORKER_URL) {
    try {
      reply = await askGemini(c, text);
      state.failures = 0;
    } catch (err) {
      if (err.status === 429) {
        // Sending too fast: the character says so in her own voice. Not an outage, so no failure count.
        return { text: pick(c.busy[state.lastLang] || c.busy.en), error: true };
      }
      state.failures++;
      console.warn("Gemini unavailable, using backup replies:", err.message);
    }
  }
  // Backup: Pocomon uses the rule library, the others use their own fallback lines.
  return { text: reply || (c.library ? local.reply : pick(c.fallback[state.lastLang] || c.fallback.en)) };
}
