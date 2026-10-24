// App pages: the chat list (/), the games (/games/, /games/<slug>/) and Me (/me/).
// Progress is kept in this browser.

import { load, recordRun } from "../games/progress.js";
import { loadMode } from "../storage.js";
import { T, lang, pickLine } from "../games/text.js";
import { startHub } from "../games/hub.js";
import { startRunner } from "../games/runner.js";
import { startHome } from "./home.js";
import { startMe, refreshMe } from "./me.js";
import { refresh } from "../games/account.js";

const { page, game: gameSlug, char: charId } = document.body.dataset;
const $ = (id) => document.getElementById(id);

function showWallet() {
  if ($("wallet")) $("wallet").textContent = `${T.candles}: ${load().candles}`;
}

// Static English text is the default; an Indonesian browser gets Indonesian.
function translateChrome() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-t]")) if (typeof T[el.dataset.t] === "string") el.textContent = T[el.dataset.t];
  for (const el of document.querySelectorAll("[data-t-label]")) {
    const label = T[el.dataset.tLabel];
    el.setAttribute("aria-label", label);
    el.title = label;
  }
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${src}`));
    img.src = src;
  });

async function startGame() {
  const [games, chars] = await Promise.all([getJson("games.json"), getJson("characters.json")]);
  const game = games.games.find((g) => g.slug === gameSlug);
  const char = chars.characters.find((c) => c.id === charId);
  const hero = await loadImage(char.stage);

  $("how").textContent = game.how[lang];
  $("rAgain").textContent = T.again;
  $("rChat").textContent = T.chatWith(char.name);
  $("rChat").setAttribute("href", loadMode(char.id) === "history" ? `${char.slug}/history/` : `${char.slug}/`);
  document.documentElement.style.setProperty("--accent", char.accent);

  const result = $("result");
  const runner = startRunner($("game"), {
    hero,
    accent: char.accent,
    best: load().best[gameSlug] || 0,
    startText: T.tapToStart,
    onOver(score) {
      const r = recordRun(gameSlug, charId, score);
      const tier = score < 200 ? "low" : score < 600 ? "mid" : "high";
      $("rTitle").textContent = r.newBest && r.best > 0 && score > 0 ? T.record : T.over;
      $("rScore").textContent = `${T.score} ${score} \u00b7 ${T.best} ${r.best}`;
      $("rReward").textContent = [T.reward(r.candles, r.xp), r.capped ? T.capped : "", r.levelAfter > r.levelBefore ? T.levelUp(r.levelAfter) : ""]
        .filter(Boolean).join(" ");
      const lines = (r.newBest && score >= 100 ? game.reactions.record : game.reactions[tier])[lang];
      $("rSay").textContent = pickLine(lines);
      showWallet();
      setTimeout(() => { result.hidden = false; $("rAgain").focus(); }, 450);
    },
  });
  $("rAgain").addEventListener("click", () => {
    result.hidden = true;
    runner.restart(load().best[gameSlug] || 0);
  });
}

translateChrome();
showWallet();
if (page === "home") startHome();
else if (page === "me") startMe();
else if (page === "hub") startHub();
else if (page === "game") startGame().catch((err) => {
  $("how").textContent = `Could not start the game (${err.message}). Run "python3 tools/build_all.py" and open the site through a web server.`;
});

// Signed in: bring the account's progress in, then draw the numbers again.
refresh().then((user) => {
  if (!user) return;
  showWallet();
  if (page === "hub") startHub();
  if (page === "me") refreshMe();
});
