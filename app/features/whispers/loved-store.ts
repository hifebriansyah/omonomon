// The whispers a visitor loved. Kept in this browser, each with a copy of its text: the feed may delete old whispers,
// but a loved one stays here. (Not saved to the account yet.) Browser only: call these after hydration.
import { KEYS, type LovedWhisper, getJson, setJson } from "~/lib/storage";
import type { Whisper } from "./types";

const MAX = 200;

function read(): LovedWhisper[] {
  const list = getJson<LovedWhisper[]>(KEYS.loved);
  return Array.isArray(list) ? list.filter((w) => w && Number.isFinite(w.n) && w.text?.en) : [];
}
function write(list: LovedWhisper[]) {
  setJson(KEYS.loved, list.slice(0, MAX));
}

/** Newest loved first. */
export const lovedList = () => read();
export const isLoved = (n: number) => read().some((w) => w.n === n);

/** Loves a whisper (keeping a copy of it) or takes the love back. Returns true when it is loved afterwards. */
export function toggleLove(whisper: Pick<Whisper, "n" | "ghost" | "t" | "text" | "link">): boolean {
  const list = read();
  if (list.some((w) => w.n === whisper.n)) {
    write(list.filter((w) => w.n !== whisper.n));
    return false;
  }
  write([{ n: whisper.n, ghost: whisper.ghost, t: whisper.t, text: { en: whisper.text.en, id: whisper.text.id ?? null }, link: whisper.link || null, lovedAt: Date.now() }, ...list]);
  return true;
}

export function removeLove(n: number) {
  write(read().filter((w) => w.n !== n));
}
