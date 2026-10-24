// A player's progress: candles, bond XP per ghost, best scores. Saved in this browser for now
// (guest mode); signing in will copy it to the account.

const KEY = "ghostgame:v1";
// XP needed to reach level 1..10 (a ghost's bond grows with games, later also with chatting)
export const LEVELS = [0, 50, 120, 210, 320, 450, 600, 770, 960, 1170];
const DAILY_CANDLE_CAP = 60;
const MAX_CANDLES_PER_RUN = 15;
const SCORE_PER_CANDLE = 50;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const blank = () => ({ candles: 0, bond: {}, best: {}, plays: 0, daily: { date: today(), candles: 0 } });

export function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && typeof p === "object") {
      return { ...blank(), ...p, daily: p.daily?.date === today() ? p.daily : { date: today(), candles: 0 } };
    }
  } catch {}
  return blank();
}

function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} // private mode: it still works this visit
}

export function levelOf(xp) {
  let level = 1;
  for (let i = 1; i < LEVELS.length; i++) if (xp >= LEVELS[i]) level = i + 1;
  return level;
}

// How far through the current level: { level, pct } (pct 100 at the top level)
export function levelProgress(xp) {
  const level = levelOf(xp);
  if (level >= LEVELS.length) return { level, pct: 100 };
  const base = LEVELS[level - 1];
  return { level, pct: Math.round(((xp - base) / (LEVELS[level] - base)) * 100) };
}

// Book the result of one run. Returns what to show the player.
export function recordRun(game, charId, score) {
  const p = load();
  const wanted = Math.min(MAX_CANDLES_PER_RUN, Math.floor(score / SCORE_PER_CANDLE));
  const candles = Math.min(wanted, Math.max(0, DAILY_CANDLE_CAP - p.daily.candles));
  const xp = 5 + candles * 2; // playing always grows the bond a little
  const levelBefore = levelOf(p.bond[charId] || 0);
  p.candles += candles;
  p.daily.candles += candles;
  p.bond[charId] = (p.bond[charId] || 0) + xp;
  const prevBest = p.best[game] || 0;
  const newBest = score > prevBest;
  if (newBest) p.best[game] = score;
  p.plays += 1;
  save(p);
  return {
    candles, xp, newBest, best: Math.max(prevBest, score), capped: candles < wanted,
    levelBefore, levelAfter: levelOf(p.bond[charId]),
  };
}
