// What a ghost remembers about a signed-in player: a short note (names, interests) rewritten by Gemini every few messages and
// kept in the player's progress, so it follows the account across devices. Guests have no memory. The note is sent along with
// each chat request (see replies.js); the Worker treats it as background only.

import { load, saveProgress } from "./progress.js";
import { signedIn, accountsEnabled } from "./account.js";

const EVERY = 8; // user messages between two updates of the note
const counts = {};
const busy = {};

export const memoryOf = (charId) => (accountsEnabled() && signedIn() ? load().memory?.[charId] || "" : "");

// Call after every message the player sends. `history` is the chat so far: [{ role: "user" | "model", text }].
export async function maybeUpdateMemory(charId, history) {
  if (!accountsEnabled() || !signedIn() || busy[charId]) return;
  counts[charId] = (counts[charId] || 0) + 1;
  if (counts[charId] % EVERY !== 0) return;
  busy[charId] = true;
  try {
    const res = await fetch(window.POCO_CONFIG.WORKER_URL.replace(/\/+$/, "") + "/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: charId, previous: memoryOf(charId), messages: history.slice(-16) }),
    });
    if (!res.ok) return;
    const { memory } = await res.json();
    if (typeof memory !== "string" || !memory.trim()) return;
    const p = load();
    p.memory = { ...(p.memory || {}), [charId]: memory.slice(0, 400) };
    saveProgress(p);
  } catch {} finally {
    busy[charId] = false;
  }
}
