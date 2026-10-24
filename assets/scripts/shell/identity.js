// Who a visitor is when they comment, without signing in: a nickname (made up for them, changeable on the Me page) and a random
// device id kept in this browser. The id is sent with a comment; the server stores only a hash of it, to keep daily limits
// and to let the author delete their own comments. Both live in localStorage.

const NICK_KEY = "ghostnick";
const DEVICE_KEY = "ghostdevice";
const MINE_KEY = "ghostmine"; // numbers of the comments this browser posted (to show a delete button)

export const NICKNAME = /^[\p{L}\p{N} _-]{2,24}$/u;
const ADJECTIVES = ["Sleepy", "Quiet", "Foggy", "Dusty", "Silver", "Moonlit", "Tiny", "Shy", "Cold", "Cozy", "Drowsy", "Pale"];
const NOUNS = ["Moth", "Lantern", "Candle", "Owl", "Bat", "Kitten", "Petal", "Pumpkin", "Raven", "Spider", "Willow", "Cobweb"];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const randomNickname = () => `${pick(ADJECTIVES)} ${pick(NOUNS)} ${10 + Math.floor(Math.random() * 90)}`;

export function nickname() {
  try {
    const saved = localStorage.getItem(NICK_KEY);
    if (saved && NICKNAME.test(saved)) return saved;
    const made = randomNickname();
    localStorage.setItem(NICK_KEY, made);
    return made;
  } catch {
    return randomNickname(); // no storage: a new one each visit
  }
}

// Saves a nickname the visitor typed. Returns the cleaned nickname, or null when it is not allowed.
export function setNickname(value) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (!NICKNAME.test(clean)) return null;
  try { localStorage.setItem(NICK_KEY, clean); } catch {}
  return clean;
}

export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || id.length < 16) {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "device-without-storage-0000";
  }
}

export function myComments() {
  try { return new Set(JSON.parse(localStorage.getItem(MINE_KEY)) || []); } catch { return new Set(); }
}
export function rememberComment(n) {
  const all = [...myComments(), n].slice(-300);
  try { localStorage.setItem(MINE_KEY, JSON.stringify(all)); } catch {}
}
export function forgetComment(n) {
  try { localStorage.setItem(MINE_KEY, JSON.stringify([...myComments()].filter((x) => x !== n))); } catch {}
}
