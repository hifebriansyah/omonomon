// Who a visitor is when they comment, without signing in: a nickname (made up for them, changeable on the Me page) and a random
// device id kept in this browser. The id is sent with a comment; the server stores only a hash of it, to keep daily limits
// and to let the author delete their own comments. Browser only: call these after hydration.
import { KEYS, getJson, getText, hasStorage, setJson, setText } from "~/lib/storage";

export const NICKNAME = /^[\p{L}\p{N} _-]{2,24}$/u;
const ADJECTIVES = ["Sleepy", "Quiet", "Foggy", "Dusty", "Silver", "Moonlit", "Tiny", "Shy", "Cold", "Cozy", "Drowsy", "Pale"];
const NOUNS = ["Moth", "Lantern", "Candle", "Owl", "Bat", "Kitten", "Petal", "Pumpkin", "Raven", "Spider", "Willow", "Cobweb"];
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export const randomNickname = () => `${pick(ADJECTIVES)} ${pick(NOUNS)} ${10 + Math.floor(Math.random() * 90)}`;

export function nickname(): string {
  const saved = getText(KEYS.nick);
  if (saved && NICKNAME.test(saved)) return saved;
  const made = randomNickname();
  setText(KEYS.nick, made); // no storage: a new one each visit
  return made;
}

/** Saves a nickname the visitor typed. Returns the cleaned nickname, or null when it is not allowed. */
export function setNickname(value: string): string | null {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (!NICKNAME.test(clean)) return null;
  setText(KEYS.nick, clean);
  return clean;
}

export function deviceId(): string {
  if (!hasStorage()) return "device-without-storage-0000";
  let id = getText(KEYS.device);
  if (!id || id.length < 16) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    setText(KEYS.device, id);
  }
  return id;
}

// Numbers of the comments this browser posted (to show a delete button), at most 300.
export function myComments(): Set<number> {
  const list = getJson<number[]>(KEYS.mine);
  return new Set(Array.isArray(list) ? list : []);
}
export function rememberComment(n: number) {
  setJson(KEYS.mine, [...myComments(), n].slice(-300));
}
export function forgetComment(n: number) {
  setJson(KEYS.mine, [...myComments()].filter((x) => x !== n));
}
