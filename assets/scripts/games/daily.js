// Daily Challenge: the same seeded run for everyone each day, with its own weekly board. The day's game alternates between Hop Hop
// and Hair Catch; the seed is the local date, and "Play again" replays exactly the same obstacles (the board keeps the best).

import { startRunner } from "./runner.js";
import { startCatch } from "./catch.js";

// A small seeded generator (mulberry32). The same seed always gives the same sequence.
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dateString = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const seedOf = (date) => [...date].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
// Which game and ghost the day uses: by the day number, so everyone sees the same one.
export function todaysPick(date = dateString()) {
  const day = Math.floor(Date.UTC(...date.split("-").map((n, i) => (i === 1 ? n - 1 : Number(n)))) / 86400000);
  return day % 2 === 0 ? { game: "hop-hop", char: "1" } : { game: "hair-catch", char: "4" };
}

const TEXT = {
  en: { head: (title) => `Today: ${title}`, same: "Same run for everyone today", games: { "hop-hop": "Hop Hop", "hair-catch": "Hair Catch" }, start: "Tap or press Space to start" },
  id: { head: (title) => `Hari ini: ${title}`, same: "Rintangan sama untuk semua orang hari ini", games: { "hop-hop": "Hop Hop", "hair-catch": "Hair Catch" }, start: "Tap atau tekan Spasi untuk mulai" },
};

export function start(root, ctx) {
  const t = TEXT[ctx.lang] || TEXT.en;
  const date = dateString();
  const pick = todaysPick(date);
  const char = ctx.chars.find((c) => c.id === pick.char) || ctx.char;
  root.style.cssText = "display:grid;justify-items:center;gap:8px;padding:10px;";
  const title = document.createElement("p");
  title.style.cssText = "margin:0;font-weight:700;";
  title.textContent = t.head(t.games[pick.game]);
  const note = document.createElement("small");
  note.style.cssText = "opacity:.7;";
  note.textContent = `${t.same} (${date})`;
  const canvas = document.createElement("canvas");
  canvas.tabIndex = 0;
  canvas.style.cssText = "width:100%;max-width:480px;height:auto;aspect-ratio:480/270;border-radius:10px;background:#15142b;";
  root.append(title, note, canvas);

  let inner = null;
  let destroyed = false;
  let rng = makeRng(seedOf(date));
  const img = new Image();
  img.onload = () => {
    if (destroyed) return;
    const options = { hero: img, accent: char.accent, best: ctx.best, startText: t.start, onOver: (score) => ctx.onOver(score, { char: char.id }), rng: () => rng() };
    inner = pick.game === "hop-hop" ? startRunner(canvas, options) : startCatch(canvas, options);
  };
  img.src = char.stage;
  return {
    restart(best) { rng = makeRng(seedOf(date)); inner?.restart(best); }, // the same obstacles again
    destroy() { destroyed = true; inner?.destroy(); root.replaceChildren(); root.removeAttribute("style"); },
  };
}
