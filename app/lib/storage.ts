// The only file that touches localStorage and sessionStorage. Every key and value shape is the same as the old site's, so
// nobody loses chats or progress. Every access is wrapped: private mode or full storage just means nothing is saved.
// Features call the typed helpers below; Storybook swaps the backend for a fake one (setStorageBackend).

export interface ChatMessage {
  who: "user" | "bot";
  text: string;
  t?: number; // ms since 1970; chats saved before times existed have none
  g?: boolean; // the greeting (never saved)
  e?: boolean; // an error message (kept, but never sent to Gemini)
}

export interface LovedWhisper {
  n: number;
  ghost: string;
  t: number;
  text: { en: string; id: string | null };
  link: unknown;
  lovedAt: number;
}

export interface Session {
  token: string;
  user?: { email?: string; name?: string; picture?: string; [k: string]: unknown } | null;
  [k: string]: unknown;
}

export interface RiddleDone {
  date: string;
  score: number;
}

/** ghostgame:v1. Fields are as games/progress.js wrote them; features/games/progress.ts fills in the defaults. */
export interface Progress {
  weekly: { week: string; plays: number; done: boolean };
  candles: number;
  spent: number;
  owned: string[];
  equipped: { stage: string; bubble: string; frame: string };
  bond: Record<string, number>;
  best: Record<string, number>;
  plays: number;
  streak: { count: number; last: string };
  bestStreak: number;
  badges: string[];
  memory: Record<string, string>;
  social: { comments: number; loves: number };
  daily: {
    date: string;
    candles: number;
    chatXp: Record<string, number>;
    messages: number;
    chatWith: Record<string, number>;
    plays: number;
    topScore: number;
    bondXp: number;
    done: string[];
  };
  [k: string]: unknown;
}

export const KEYS = {
  chat: (id: string) => `ghostchat:v1:${id}`, // ChatMessage[] (without the greeting), at most 60
  mode: (id: string) => `ghostmode:v1:${id}`, // "history" or missing
  seen: (id: string) => `ghostseen:v1:${id}`, // ms as text
  progress: "ghostgame:v1", // Progress
  session: "ghostgame:session", // Session
  loved: "ghostloved:v1", // LovedWhisper[], newest first, at most 200
  whisperSeen: "ghostwhisper:seen", // ms as text
  nick: "ghostnick", // plain text
  device: "ghostdevice", // plain text (random, url-safe base64)
  mine: "ghostmine", // number[] (comment numbers), at most 300
  lastGame: "ghostlast", // game slug
  prefs3d: "ghost3d", // "on" | "off"
  lang: "ghostlang", // "en" | "id"
  riddleDone: "ghostriddle:done", // RiddleDone
} as const;

export const SESSION_KEYS = {
  whisperChecked: "ghostwhisper:checked", // ms as text
  whisperCheckedNew: "ghostwhisper:checked:new", // "0" | "1"
  scroll: (path: string) => `scroll:${path}`, // scrollY as text
  langChecked: "ghostlang:checked", // "1" once the first-visit language redirect has run in this tab (new)
} as const;

export interface StorageBackend {
  local: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  session: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}

function browserBackend(): StorageBackend | null {
  try {
    if (typeof window === "undefined") return null;
    return { local: window.localStorage, session: window.sessionStorage };
  } catch {
    return null;
  }
}

let backend: StorageBackend | null | undefined;
const store = () => (backend === undefined ? (backend = browserBackend()) : backend);

/** Storybook and tests: use an in-memory store instead of the real one. */
export function setStorageBackend(b: StorageBackend | null) {
  backend = b;
}

export function memoryBackend(seed: Record<string, string> = {}): StorageBackend {
  const make = (init: Record<string, string>) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) };
  };
  return { local: make(seed), session: make({}) };
}

type Area = "local" | "session";

export function getText(key: string, area: Area = "local"): string | null {
  try {
    return store()?.[area].getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function setText(key: string, value: string, area: Area = "local"): void {
  try {
    store()?.[area].setItem(key, value);
  } catch {} // private mode or storage full: it still works this visit
}

export function remove(key: string, area: Area = "local"): void {
  try {
    store()?.[area].removeItem(key);
  } catch {}
}

export function getJson<T>(key: string, area: Area = "local"): T | null {
  const raw = getText(key, area);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setJson(key: string, value: unknown, area: Area = "local"): void {
  setText(key, JSON.stringify(value), area);
}

/** True when the browser has storage at all (false during pre-render). */
export const hasStorage = () => store() !== null;
