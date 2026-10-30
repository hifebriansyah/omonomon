// Saved chats: one entry per character in this browser's localStorage (was assets/scripts/storage.js).
// Nothing here leaves the visitor's device. Same keys and shapes as the old site, through lib/storage.ts.
import { type ChatMessage, KEYS, getJson, getText, remove, setJson, setText } from "~/lib/storage";
import type { Turn } from "./engine/types";

export const MAX_SAVED = 60; // messages kept per character

/** The saved chat with ghost `id` (without the greeting), or null when there is none. */
export function loadLog(id: string): ChatMessage[] | null {
  const arr = getJson<unknown>(KEYS.chat(id));
  if (!Array.isArray(arr)) return null;
  return (arr as ChatMessage[])
    .filter((m) => m && !m.g && (m.who === "user" || m.who === "bot") && typeof m.text === "string")
    .map((m) => (Number.isFinite(m.t) ? m : { ...m, t: undefined })) // chats saved before times existed have none
    .slice(-MAX_SAVED);
}

/**
 * Save the chat shown for ghost `id` and give it back trimmed: the greeting stays in front, then the last MAX_SAVED messages.
 * Saved chats are keyed by the character's id, which never changes. The greeting is left out (it is rebuilt on load), so
 * renaming a character never leaves her old name inside someone's saved history.
 */
export function saveLog(id: string, messages: ChatMessage[]): ChatMessage[] {
  const greeting = messages.filter((m) => m.g);
  const kept = messages.filter((m) => !m.g).slice(-MAX_SAVED);
  setJson(KEYS.chat(id), kept); // private mode or storage full: the chat still works, it just isn't saved
  return [...greeting, ...kept];
}

export function removeLog(id: string) {
  remove(KEYS.chat(id));
}

/** The context sent to Gemini, from the shown messages: complete user/reply pairs only, without greetings or error messages. */
export function rebuildHistory(messages: readonly ChatMessage[]): Turn[] {
  const out: Turn[] = [];
  let user: string | null = null;
  for (const m of messages) {
    if (m.g || m.e) continue;
    if (m.who === "user") user = m.text;
    else if (user !== null) {
      out.push({ role: "user", text: user }, { role: "model", text: m.text });
      user = null;
    }
  }
  return out;
}

// Which view a chat was left in: "history" (the history panel was open) or the default stage.
// The chat list opens a chat in the same view, so history > back > the same chat > still history.
export function loadMode(id: string): "history" | "stage" {
  return getText(KEYS.mode(id)) === "history" ? "history" : "stage";
}

export function saveMode(id: string, history: boolean) {
  if (history) setText(KEYS.mode(id), "history");
  else remove(KEYS.mode(id));
}

// When this visitor first met a ghost (the first time the list or her chat was shown). It dates her greeting and
// the "last message" of a chat that has not started, like the first message of a new WhatsApp contact.
export function firstSeen(id: string): number {
  const saved = Number(getText(KEYS.seen(id)));
  if (Number.isFinite(saved) && saved > 0) return saved;
  const now = Date.now();
  setText(KEYS.seen(id), String(now)); // no storage: the greeting just gets today's time
  return now;
}
