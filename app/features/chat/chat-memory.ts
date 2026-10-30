// What a ghost remembers about a signed-in player: a short note (names, interests) rewritten by Gemini every few messages and
// kept in the player's progress, so it follows the account across devices. Guests have no memory. The note is sent along with
// each chat request (see engine/replies.ts); the Worker treats it as background only.
import { accountsEnabled, signedIn } from "~/features/account/account";
import { load, saveProgress } from "~/features/games/progress";
import { config } from "~/lib/config";
import type { Turn } from "./engine/types";

const EVERY = 8; // user messages between two updates of the note
const counts: Record<string, number> = {};
const busy: Record<string, boolean> = {};

export const memoryOf = (charId: string): string => (accountsEnabled() && signedIn() ? load().memory?.[charId] || "" : "");

/** Call after every message the player sends. `history` is the chat so far. */
export async function maybeUpdateMemory(charId: string, history: readonly Turn[]) {
  if (!accountsEnabled() || !signedIn() || busy[charId]) return;
  counts[charId] = (counts[charId] || 0) + 1;
  if (counts[charId] % EVERY !== 0) return;
  busy[charId] = true;
  try {
    const res = await fetch(`${config.WORKER_URL}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character: charId, previous: memoryOf(charId), messages: history.slice(-16) }),
    });
    if (!res.ok) return;
    const { memory } = (await res.json()) as { memory?: unknown };
    if (typeof memory !== "string" || !memory.trim()) return;
    const p = load();
    p.memory = { ...(p.memory || {}), [charId]: memory.slice(0, 400) };
    saveProgress(p);
  } catch {
  } finally {
    busy[charId] = false;
  }
}
