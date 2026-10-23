// Saved chats: one entry per character in this browser's localStorage.
// Nothing here leaves the visitor's device.

import { state } from "./state.js";

const STORE_PREFIX = "ghostchat:v1:";
const MAX_SAVED = 60; // messages kept per character

export function loadLog(id) {
  try {
    const arr = JSON.parse(localStorage.getItem(STORE_PREFIX + id));
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((m) => m && (m.who === "user" || m.who === "bot") && typeof m.text === "string")
      .slice(-MAX_SAVED);
  } catch {
    return null;
  }
}

export function saveLog(id) {
  if (state.logs[id].length > MAX_SAVED) state.logs[id] = state.logs[id].slice(-MAX_SAVED);
  try {
    localStorage.setItem(STORE_PREFIX + id, JSON.stringify(state.logs[id]));
  } catch {} // private mode or storage full: the chat still works, it just isn't saved
}

export function removeLog(id) {
  try { localStorage.removeItem(STORE_PREFIX + id); } catch {}
}

// The context sent to Gemini comes from the saved messages: complete user/reply pairs
// only, without greetings or error messages.
export function rebuildHistory(id) {
  const out = [];
  let user = null;
  for (const m of state.logs[id] || []) {
    if (m.g || m.e) continue;
    if (m.who === "user") user = m.text;
    else if (user !== null) {
      out.push({ role: "user", text: user }, { role: "model", text: m.text });
      user = null;
    }
  }
  state.histories[id] = out;
}

// Which character was on stage last time.
export function loadCharacter() {
  try { return localStorage.getItem("character"); } catch { return null; }
}
export function saveCharacter(id) {
  try { localStorage.setItem("character", id); } catch {}
}
