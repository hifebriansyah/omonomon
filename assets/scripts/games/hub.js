// The /games/ page: fill each card with the player's bond level and best score.

import { load, levelProgress } from "./progress.js";
import { T } from "./text.js";

export function startHub() {
  const p = load();
  for (const card of document.querySelectorAll(".card[data-game]")) {
    const bond = card.querySelector("[data-bond]");
    const best = card.querySelector("[data-best]");
    const { level, pct } = levelProgress(p.bond[card.dataset.char] || 0);
    if (bond) {
      bond.textContent = `${T.bond} ${level}`;
      bond.style.setProperty("--pct", `${pct}%`);
    }
    if (best && p.best[card.dataset.game]) best.textContent = `${T.best} ${p.best[card.dataset.game]}`;
  }
}
