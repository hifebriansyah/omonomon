// The chat itself (was assets/scripts/chat.js): who is on stage, sending a message, getting the reply, saving the conversation.
// It lives outside React so a reply that arrives after the visitor left the page is still saved, as the old site did while the
// page was open. The screen (ChatScreen.tsx) reads it with useChat() and does the animations.
import { create } from "zustand";
import { toast } from "~/components/Toast";
import { maybeUpdateMemory, memoryOf } from "./chat-memory";
import { engine, getReply, inLang, resetEngine, type Reply, type Speaker } from "./engine";
import { firstSeen, loadLog, rebuildHistory, saveLog } from "./history-store";
import { levelOf, load as loadProgress, recordChat } from "~/features/games/progress";
import { ALL_DONE_BONUS, questLabel } from "~/features/games/quests";
import { todOf } from "~/features/games/tod";
import { i18nFor, tr } from "~/i18n";
import { type Character, type Lang, type Localized, characters, trouble } from "~/lib/content";
import type { ChatMessage } from "~/lib/storage";
import { pick } from "~/lib/util";

/** A character as the chat reads her. */
export type ChatCharacter = Character & Speaker & { moods?: Localized<string[]> };
export const asChat = (c: Character) => c as ChatCharacter;

const TROUBLE_AFTER = 3;
// From bond level 2 she sometimes greets you with one of her own lines instead of the usual one.
const GREETING_LEVEL = 2;

interface ChatState {
  ready: boolean;
  startError: string | null;
  current: string | null; // the ghost on stage
  logs: Record<string, ChatMessage[]>; // character id -> messages shown (the greeting first) and saved
  pending: Record<string, number>; // character id -> replies still on the way
  trouble: string | null; // status text while Gemini keeps failing (null: her own status)
}

const initial = (): ChatState => ({ ready: true, startError: null, current: null, logs: {}, pending: {}, trouble: null });
export const useChat = create<ChatState>(initial);
const get = useChat.getState;
const set = useChat.setState;

let pageLang: Lang = "en";

/** Stories: answer with this instead of the engine (no network). */
export type ReplyFn = (c: ChatCharacter, text: string) => Promise<Reply>;
let replyFn: ReplyFn | null = null;
export const setReplyFn = (fn: ReplyFn | null) => void (replyFn = fn);

/** Set the page language as the chat's initial language. */
export async function startChat(lang: Lang): Promise<boolean> {
  pageLang = lang;
  engine.lastLang = lang;
  set({ ready: true, startError: null });
  return true;
}

const bondGreeting: Record<string, string | null> = {}; // her pick for this page load (null: the usual greeting), so every place that shows the greeting agrees
function greeting(c: ChatCharacter): string {
  if (!(c.id in bondGreeting)) {
    const g = c.bondGreetings as Partial<Record<string, string[]>> | undefined;
    const extra = (engine.lastLang && g?.[engine.lastLang]) || g?.[pageLang] || g?.en;
    const open = extra?.length && levelOf(loadProgress().bond[c.id] || 0) >= GREETING_LEVEL && Math.random() < 0.5;
    bondGreeting[c.id] = open ? pick(extra) : null;
  }
  const own = bondGreeting[c.id];
  if (own) return own;
  return inLang(c.greeting) || "";
}

// The greeting is not saved, but it has a time: when you first met her (or the oldest saved message, if earlier).
const greetingMessage = (c: ChatCharacter, saved: ChatMessage[] = []): ChatMessage => ({
  who: "bot",
  text: greeting(c),
  g: true,
  t: Math.min(firstSeen(c.id), saved[0]?.t ?? Infinity),
});

/**
 * Put a character on stage, restoring her saved chat (or starting with her greeting). `seed` replaces the saved chat (stories).
 * Returns whether the chat is fresh (only the greeting): then the greeting is typed out, otherwise shown at once.
 */
export function selectCharacter(c: ChatCharacter, seed?: ChatMessage[]): { fresh: boolean } {
  const { logs, pending } = get();
  let log = logs[c.id];
  // Read her saved chat again each time she comes on stage (the old pages did on every load; the chat list may have cleared
  // it since), unless a reply is still on the way.
  if (!(pending[c.id] > 0) || !log?.length) {
    const saved = seed ?? loadLog(c.id);
    // the greeting is not saved: show today's greeting (and today's name) above the old messages
    log = saved?.length ? [greetingMessage(c, saved), ...saved] : [];
    engine.histories[c.id] = rebuildHistory(log);
  }
  const fresh = !log.length;
  if (fresh) log = [greetingMessage(c)];
  set({ current: c.id, logs: { ...logs, [c.id]: log } });
  return { fresh };
}

// Record a message for character `id` (the screen shows it if she is on stage).
function say(id: string, who: ChatMessage["who"], text: string, flags: Partial<ChatMessage> = {}, extra: Partial<ChatState> = {}) {
  const msg: ChatMessage = { who, text, t: Date.now(), ...flags };
  const log = saveLog(id, [...(get().logs[id] || []), msg]);
  set({ ...extra, logs: { ...get().logs, [id]: log } });
}

const bump = (id: string, by: number) => ({ pending: { ...get().pending, [id]: Math.max(0, (get().pending[id] || 0) + by) } });

async function botReply(c: ChatCharacter, text: string) {
  set(bump(c.id, 1));
  const delay = new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
  let reply: string;
  let failed = false;
  try {
    const ctx = {
      bond: levelOf(loadProgress().bond[c.id] || 0), // how close the player is to this ghost (1 to 10)
      tod: todOf(), // the hour in Jakarta: the ghost's mood follows it
      memory: memoryOf(c.id) || undefined, // signed-in players: what she remembers about them
    };
    ({ text: reply, error: failed = false } = await (replyFn ? replyFn(c, text) : getReply(c, text, ctx)));
  } catch (err) {
    reply = `Something went wrong (${(err as Error).message}).`;
    failed = true;
  }
  await delay;
  // After a few Gemini failures in a row the status line says so, until the next success.
  const troubleNow = engine.failures >= TROUBLE_AFTER ? inLang(trouble) || null : null;
  if (!failed) (engine.histories[c.id] ||= []).push({ role: "user", text }, { role: "model", text: reply });
  say(c.id, "bot", reply, failed ? { e: true } : {}, { ...bump(c.id, -1), trouble: troubleNow });
}

/** Called by the message box. Returns false if the chat isn't ready, so the text stays put. */
export function sendMessage(c: ChatCharacter, text: string): boolean {
  if (get().current !== c.id) return false;
  say(c.id, "user", text);
  rewardMessage(c);
  maybeUpdateMemory(c.id, engine.histories[c.id] || []);
  void botReply(c, text);
  return true;
}

// A sent message earns a little bond XP and counts for the daily quests; tell the player about the good news (in the page language).
function rewardMessage(c: ChatCharacter) {
  const r = recordChat(c.id, characters);
  const lang = pageLang;
  const t = i18nFor(lang).t as unknown as (k: string, o?: Record<string, unknown>) => unknown;
  const titles = t("titles", { returnObjects: true }) as string[];
  const badges = t("badges", { returnObjects: true }) as Record<string, string[] | undefined>;
  const lines: string[] = [];
  if (r.levelAfter > r.levelBefore) lines.push(tr(lang, "bondLevelUp", { name: c.name, level: r.levelAfter, title: titles[r.levelAfter - 1] }));
  for (const q of r.completed) lines.push(tr(lang, "questDone", { label: questLabel(q, lang, characters), candles: q.reward }));
  if (r.allDone) lines.push(tr(lang, "allQuestsDone", { bonus: ALL_DONE_BONUS }));
  for (const id of r.badges) lines.push(tr(lang, "badgeUnlocked", { name: badges[id]?.[0] || id }));
  if (lines.length) toast(lines);
}

// ---- Stories and tests ----

/** Forget everything (the engine too), as a fresh page load would. */
export function resetChat() {
  resetEngine();
  for (const k of Object.keys(bondGreeting)) delete bondGreeting[k];
  replyFn = null;
  set(initial());
}

/** Stories: a reply on the way (the thinking dots), or the "having trouble" status. */
export const setPending = (id: string, n: number) => set({ pending: { ...get().pending, [id]: n } });
export const setTrouble = (on: boolean) => set({ trouble: on ? inLang(trouble) || null : null });
export const setStartError = (text: string | null) => set({ startError: text });
