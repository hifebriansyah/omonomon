// App pages: the chat list (/), the games (/games/, /games/<slug>/) and Me (/me/).
// Progress is kept in this browser.

import { load, recordRun } from "../games/progress.js";
import { loadMode } from "../storage.js";
import { questLabel } from "../games/quests.js";
import { T, lang, pickLine } from "../games/text.js";
import { startHub } from "../games/hub.js";
import { startRunner } from "../games/runner.js";
import { startMemory } from "../games/memory.js";
import { startCatch } from "../games/catch.js";
import { startRounds } from "../games/rounds.js";
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

  $("how").textContent = game.how[lang];
  $("rAgain").textContent = T.again;
  $("rChat").textContent = T.chatWith(char.name);
  $("rChat").setAttribute("href", loadMode(char.id) === "history" ? `${char.slug}/history/` : `${char.slug}/`);
  document.documentElement.style.setProperty("--accent", char.accent);

  const [lowTier, midTier] = game.tiers || [200, 600]; // score limits for the "low" and "mid" reactions
  const recordMin = game.recordMin ?? 100;             // from this score on, a new best gets the "record" reaction
  const result = $("result");

  // What happens when a run ends (the same for every kind of game).
  function onOver(score) {
    const r = recordRun(gameSlug, charId, score, chars.characters, game.scorePerCandle);
    const tier = score < lowTier ? "low" : score < midTier ? "mid" : "high";
    $("rTitle").textContent = r.newBest && r.best > 0 && score > 0 ? T.record : (game.overTitle?.[lang] || T.over);
    $("rScore").textContent = `${T.score} ${score} \u00b7 ${T.best} ${r.best}`;
    $("rReward").textContent = [T.reward(r.candles, r.xp), r.capped ? T.capped : "", r.levelAfter > r.levelBefore ? T.levelUp(r.levelAfter) : ""]
      .filter(Boolean).join(" ");
    $("rQuests").textContent = [
      ...r.completed.map((q) => T.questDone(questLabel(q, lang, chars.characters), q.reward)),
      r.allDone ? T.allQuestsDone(10) : "",
      r.completed.length && r.streak ? T.streakDays(r.streak) : "",
    ].filter(Boolean).join(" \u00b7 ");
    const lines = (r.newBest && score >= recordMin ? game.reactions.record : game.reactions[tier])[lang];
    $("rSay").textContent = pickLine(lines);
    showWallet();
    setTimeout(() => { result.hidden = false; $("rAgain").focus(); }, 450);
  }

  const startText = game.startText?.[lang] || T.tapToStart;
  let play;
  if (game.type === "memory") {
    play = startMemory(document.querySelector(".play"), {
      onOver,
      text: { watch: T.memWatch, yourTurn: T.memYourTurn, wellDone: T.memWellDone, sigh: T.memSigh, begin: T.memBegin, sighs: T.memSighs, petal: T.memPetal },
    });
  } else if (game.type === "rounds") {
    play = startRounds(document.querySelector(".play"), {
      onOver,
      text: { begin: T.rdBegin, calling: T.rdCalling, thanks: T.rdThanks, missed: T.rdMissed, lives: T.rdLives, room: T.rdRoom },
    });
  } else {
    const hero = await loadImage(char.stage);
    const options = { hero, accent: char.accent, best: load().best[gameSlug] || 0, startText, onOver };
    play = game.type === "catch" ? startCatch($("game"), options) : startRunner($("game"), options);
  }
  $("rAgain").addEventListener("click", () => {
    result.hidden = true;
    play.restart(load().best[gameSlug] || 0);
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
