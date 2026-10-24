// The whispers a visitor loved. Kept in this browser, each with a copy of its text: the feed deletes whispers after 14 days,
// but a loved one stays here. (Not saved to the account yet.)

const KEY = "ghostloved:v1";
const MAX = 200;

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list.filter((w) => w && Number.isFinite(w.n) && w.text?.en) : [];
  } catch {
    return [];
  }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch {}
}

// Newest loved first.
export const lovedList = () => read();
export const isLoved = (n) => read().some((w) => w.n === n);

// Loves a whisper (keeping a copy of it) or takes the love back. Returns true when it is loved afterwards.
export function toggleLove(whisper) {
  const list = read();
  if (list.some((w) => w.n === whisper.n)) {
    write(list.filter((w) => w.n !== whisper.n));
    return false;
  }
  write([{ n: whisper.n, ghost: whisper.ghost, t: whisper.t, text: { en: whisper.text.en, id: whisper.text.id ?? null }, lovedAt: Date.now() }, ...list]);
  return true;
}

export function removeLove(n) {
  write(read().filter((w) => w.n !== n));
}
