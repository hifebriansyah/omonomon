// The /games/ page: today's quests and streak, and each card's bond level and best score.

import { load, levelProgress } from "./progress.js";
import { todaysQuests, questProgress, questLabel } from "./quests.js";
import { T, lang } from "./text.js";
import { startLeaderboard } from "./leaderboard.js";
import { hostOf, WEEKLY_TARGET, WEEKLY_REWARD } from "./event.js";

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

function showEvent(p, chars) {
  const box = document.getElementById("eventBanner");
  const host = chars.find((c) => c.id === hostOf());
  if (!box || !host) return;
  box.style.setProperty("--accent", host.accent);
  box.querySelector("img").src = host.head;
  box.querySelector("[data-event-title]").textContent = T.eventTitle(host.name);
  box.querySelector("[data-event-body]").textContent = T.eventBody(WEEKLY_TARGET, WEEKLY_REWARD);
  box.querySelector("[data-event-count]").textContent = p.weekly.done ? T.eventDone : T.eventProgress(p.weekly.plays, WEEKLY_TARGET);
  box.hidden = false;
}

const LAST_KEY = "ghostlast";
export const rememberLastGame = (slug) => { try { localStorage.setItem(LAST_KEY, slug); } catch {} };

// Filters (all / quick / one ghost), the "continue" shortcut and the NEW tags on fresh games.
function startTools(chars) {
  const cards = [...document.querySelectorAll(".card[data-game]")];
  const bar = document.getElementById("gameFilters");
  const filters = [["all", T.filterAll], ["quick", T.filterQuick], ...chars.map((c) => [`char:${c.id}`, c.name])];
  const apply = (key) => {
    for (const b of bar.children) b.setAttribute("aria-pressed", String(b.dataset.key === key));
    for (const card of cards) {
      card.hidden = !(key === "all" || (key === "quick" && card.dataset.quick) || key === `char:${card.dataset.char}`);
    }
  };
  bar.replaceChildren(...filters.map(([key, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.key = key;
    b.textContent = label;
    b.addEventListener("click", () => apply(key));
    return b;
  }));
  apply("all");
  const fresh = Date.now() - 14 * 86400_000;
  for (const card of cards) {
    // startHub runs again when the account sync finishes, so add the tag only once
    if (card.dataset.added && Date.parse(card.dataset.added) > fresh && !card.querySelector(".new-tag")) {
      const tag = document.createElement("span");
      tag.className = "new-tag";
      tag.textContent = T.newTag;
      card.querySelector("h2")?.append(" ", tag);
    }
  }
  let last = "";
  try { last = localStorage.getItem(LAST_KEY) || ""; } catch {}
  const card = cards.find((c) => c.dataset.game === last);
  const btn = document.getElementById("continueBtn");
  if (card && btn) {
    btn.href = `games/${last}/`;
    btn.textContent = T.continueGame(card.querySelector("h2")?.firstChild?.textContent || last);
    btn.hidden = false;
  }
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
  startLeaderboard();
  startTools((await characters()));
  const chars = await characters();
  showEvent(p, chars);
  showQuests(p, chars);
}
