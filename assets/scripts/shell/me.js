// The Me page: guest profile, candles, games played and the bond level with each ghost.
// Sign-in with Google will fill the profile in later.

import { load, levelProgress } from "../games/progress.js";

export function startMe() {
  const p = load();
  document.getElementById("meCandles").textContent = p.candles;
  document.getElementById("mePlayed").textContent = p.plays;
  for (const row of document.querySelectorAll(".bonds li[data-char]")) {
    const { level, pct } = levelProgress(p.bond[row.dataset.char] || 0);
    row.querySelector("[data-level]").textContent = level;
    row.querySelector(".bar").style.setProperty("--pct", `${pct}%`);
  }
}
