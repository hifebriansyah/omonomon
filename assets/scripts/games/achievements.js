// Badges: each one is a plain rule over the player's progress. Once earned a badge is kept (progress.badges), so a
// rule that stops being true later (a streak that ended) never takes it away.

const GAMES = ["hop-hop", "night-rounds", "quiet-wish", "hair-catch"];
const bondLevel = (xp, levels) => levels.filter((x) => xp >= x).length;

// `check(p, levels)`: p is the progress object; levels is the XP table from progress.js.
export const BADGES = [
  { id: "first-run", check: (p) => p.plays >= 1 },
  { id: "plays-10", check: (p) => p.plays >= 10 },
  { id: "plays-50", check: (p) => p.plays >= 50 },
  { id: "plays-100", check: (p) => p.plays >= 100 },
  { id: "all-games", check: (p) => GAMES.every((g) => (p.best[g] || 0) > 0) },
  { id: "hop-500", check: (p) => (p.best["hop-hop"] || 0) >= 500 },
  { id: "hop-1000", check: (p) => (p.best["hop-hop"] || 0) >= 1000 },
  { id: "rounds-300", check: (p) => (p.best["night-rounds"] || 0) >= 300 },
  { id: "wish-75", check: (p) => (p.best["quiet-wish"] || 0) >= 75 },
  { id: "catch-300", check: (p) => (p.best["hair-catch"] || 0) >= 300 },
  { id: "streak-3", check: (p) => (p.bestStreak || 0) >= 3 },
  { id: "streak-7", check: (p) => (p.bestStreak || 0) >= 7 },
  { id: "streak-14", check: (p) => (p.bestStreak || 0) >= 14 },
  { id: "candles-100", check: (p) => p.candles >= 100 },
  { id: "candles-500", check: (p) => p.candles >= 500 },
  { id: "candles-1000", check: (p) => p.candles >= 1000 },
  { id: "comments-10", check: (p) => (p.social?.comments || 0) >= 10 },
  { id: "first-love", check: (p) => (p.social?.loves || 0) >= 1 },
  { id: "bond-3-all", check: (p, levels) => ["1", "2", "3", "4"].every((id) => bondLevel(p.bond[id] || 0, levels) >= 3) },
  { id: "bond-10", check: (p, levels) => Object.values(p.bond).some((xp) => bondLevel(xp, levels) >= 10) },
  { id: "bond-5", check: (p, levels) => Object.values(p.bond).some((xp) => bondLevel(xp, levels) >= 5) },
  { id: "bond-5-all", check: (p, levels) => ["1", "2", "3", "4"].every((id) => bondLevel(p.bond[id] || 0, levels) >= 5) },
];

// Add the badges `p` has just earned to p.badges. Returns their ids (empty most of the time). Changes `p`.
export function settleBadges(p, levels) {
  p.badges = Array.isArray(p.badges) ? p.badges : [];
  const earned = BADGES.filter((b) => !p.badges.includes(b.id) && b.check(p, levels)).map((b) => b.id);
  p.badges.push(...earned);
  return earned;
}
