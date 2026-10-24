// Back should land exactly where the visitor left. These pages fill their list from the network after they load, so the browser's
// own scroll restore comes too early (the page is still short). The position is saved when the visitor leaves and put back once
// the list is on screen. Kept per address in sessionStorage, so it only lasts for this tab.

let ready = false; // the list is on screen and the old position has been put back: only then is scrollY worth saving
const key = () => `scroll:${location.pathname}${location.search}`;

// Call once when the page starts: remember where the visitor is whenever they leave or hide the page.
export function rememberScroll() {
  try { history.scrollRestoration = "manual"; } catch {}
  const save = () => { if (!ready) return; try { sessionStorage.setItem(key(), String(Math.round(scrollY))); } catch {} };
  addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });
}

// Call right after the list has been drawn. Only a back/forward visit restores a position; a fresh visit starts at the top.
export function restoreScroll() {
  let y = 0;
  try { y = Number(sessionStorage.getItem(key())) || 0; } catch {}
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  if (!y || (nav && nav.type !== "back_forward")) { ready = true; return; }
  requestAnimationFrame(() => { scrollTo(0, y); ready = true; });
}
