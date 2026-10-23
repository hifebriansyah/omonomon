// Getting a reply for a message.
// Order: local safety rule, then Gemini (through the Worker), then backup replies.

import { state } from "./state.js";
import { findReply } from "./rules.js";
import { pick } from "./util.js";

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
        messages: [...history.slice(-cfg.HISTORY_TURNS), { role: "user", text }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { reply } = await res.json();
    if (typeof reply !== "string" || !reply.trim()) throw new Error("empty reply");
    return reply.trim();
  } finally {
    clearTimeout(timer);
  }
}

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

  if (local.priority >= SAFETY_PRIORITY) return local.reply;

  let reply;
  if (window.POCO_CONFIG.WORKER_URL) {
    try {
      reply = await askGemini(c, text);
    } catch (err) {
      console.warn("Gemini unavailable, using backup replies:", err.message);
    }
  }
  // Backup: Pocomon uses the rule library, the others use their own fallback lines.
  return reply || (c.library ? local.reply : pick(c.fallback[state.lastLang] || c.fallback.en));
}
