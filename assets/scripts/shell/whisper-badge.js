// The dot on the Whispers tab: shown when the newest whisper is newer than the last one this browser has seen.
// It looks at most once every 2 minutes (and the API's answer is cached for 2 minutes as well).

const SEEN_KEY = "ghostwhisper:seen";
const CHECKED_KEY = "ghostwhisper:checked";

function latestSeen() {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
}
export function markSeen(t) {
  try {
    localStorage.setItem(SEEN_KEY, String(Math.max(latestSeen(), t)));
    sessionStorage.setItem(CHECKED_KEY + ":new", "0");
  } catch {}
  document.querySelector('.tab[data-tab="whispers"]')?.classList.remove("dot");
}

export async function checkBadge() {
  const tab = document.querySelector('.tab[data-tab="whispers"]');
  const base = (window.POCO_CONFIG?.API_URL || "").replace(/\/+$/, "");
  if (!tab || !base || document.body.dataset.page === "whispers") return;
  try {
    const last = Number(sessionStorage.getItem(CHECKED_KEY)) || 0;
    if (Date.now() - last < 120_000) {
      if (sessionStorage.getItem(CHECKED_KEY + ":new") === "1") tab.classList.add("dot");
      return;
    }
    sessionStorage.setItem(CHECKED_KEY, String(Date.now()));
    const res = await fetch(`${base}/whispers`);
    if (!res.ok) return;
    const newest = (await res.json()).whispers?.[0]?.t || 0;
    const fresh = newest > latestSeen();
    sessionStorage.setItem(CHECKED_KEY + ":new", fresh ? "1" : "0");
    tab.classList.toggle("dot", fresh);
  } catch {} // the dot is a nicety
}
