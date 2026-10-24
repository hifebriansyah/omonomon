// The /games/ page: today's quests and streak, and each card's bond level and best score.

import { load, levelProgress } from "./progress.js";
import { todaysQuests, questProgress, questLabel } from "./quests.js";
import { T, lang } from "./text.js";

async function characters() {
  try {
    const res = await fetch("characters.json");
    return res.ok ? (await res.json()).characters : [];
  } catch {
    return [];
  }
}

function showQuests(p, chars) {
  const list = document.getElementById("questList");
  list.replaceChildren(...todaysQuests(chars).map((q) => {
    const have = Math.min(questProgress(q, p.daily), q.target);
    const done = p.daily.done.includes(q.id);
    const li = document.createElement("li");
    li.className = done ? "quest done" : "quest";
    const label = document.createElement("span");
    label.className = "q-label";
    label.textContent = questLabel(q, lang, chars);
    const count = document.createElement("span");
    count.className = "q-count";
    count.textContent = done ? "\u2713" : `${have}/${q.target}`;
    const reward = document.createElement("span");
    reward.className = "q-reward";
    reward.textContent = `+${q.reward}`;
    li.append(label, count, reward);
    return li;
  }));
  const n = p.streak.last && (p.streak.last === p.daily.date || isYesterday(p.streak.last)) ? p.streak.count : 0;
  document.getElementById("streakText").textContent = n ? T.streakDays(n) : T.streakNone;
}

function isYesterday(date) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return date === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function startHub() {
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
  showQuests(p, await characters());
}
