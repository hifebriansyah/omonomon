// A player's progress: candles, bond XP per ghost, best scores, today's counters for the daily quests and the streak.
// Saved in this browser; signing in copies it to the account (see account.js).

import { today, yesterday, todaysQuests, questProgress, ALL_DONE_BONUS } from "./quests.js";
import { settleBadges } from "./achievements.js";
import { weekOf, hostOf, WEEKLY_TARGET, WEEKLY_REWARD } from "./event.js";

const KEY = "ghostgame:v1";
// XP needed to reach level 1..10. Bond grows by playing games and by chatting.
export const LEVELS = [0, 50, 120, 210, 320, 450, 600, 770, 960, 1170];
const DAILY_CANDLE_CAP = 60;   // candles from games per day (quest rewards are on top)
const MAX_CANDLES_PER_RUN = 15;
const SCORE_PER_CANDLE = 50;
const CHAT_XP_PER_MESSAGE = 2;
const DAILY_CHAT_XP_CAP = 20;  // chat bond XP per ghost per day (10 messages)

// Counters of today only; they belong to this device and start again every day.
const freshDaily = () => ({ date: today(), candles: 0, chatXp: {}, messages: 0, chatWith: {}, plays: 0, topScore: 0, bondXp: 0, done: [] });
const freshWeekly = () => ({ week: weekOf(), plays: 0, done: false });
const blank = () => ({ weekly: freshWeekly(), candles: 0, spent: 0, owned: [], equipped: { stage: "", bubble: "", frame: "" }, bond: {}, best: {}, plays: 0, streak: { count: 0, last: "" }, bestStreak: 0, badges: [], memory: {}, social: { comments: 0, loves: 0 }, daily: freshDaily() });

export function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && typeof p === "object") {
      const daily = p.daily?.date === today() ? { ...freshDaily(), ...p.daily } : freshDaily();
      const weekly = p.weekly?.week === weekOf() ? { ...freshWeekly(), ...p.weekly } : freshWeekly();
      return { ...blank(), ...p, weekly, owned: p.owned || [], equipped: { stage: "", bubble: "", frame: "", ...(p.equipped || {}) }, streak: { count: 0, last: "", ...(p.streak || {}) }, daily };
    }
  } catch {}
  return blank();
}

const listeners = [];
// Call `fn` after every save (the account code uses it to copy progress to the server).
export function onChange(fn) { listeners.push(fn); }

function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} // private mode: it still works this visit
  for (const fn of listeners) fn(p);
}

// Combine this browser's progress with an account's: for every number the larger one wins, so signing in on a
// second device never loses progress. The streak with the later day wins (the larger count on the same day).
// Today's counters belong to this device and are kept as they are.
export function merge(local, remote) {
  const maxTable = (a = {}, b = {}) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] || 0, v);
    return out;
  };
  const a = local.streak || { count: 0, last: "" };
  const b = remote.streak || { count: 0, last: "" };
  const streak = a.last > b.last || (a.last === b.last && a.count >= b.count) ? a : b;
  return {
    ...local,
    candles: Math.max(local.candles || 0, remote.candles || 0),
    spent: Math.max(local.spent || 0, remote.spent || 0),
    owned: [...new Set([...(local.owned || []), ...(remote.owned || [])])],
    equipped: { stage: local.equipped?.stage || remote.equipped?.stage || "", bubble: local.equipped?.bubble || remote.equipped?.bubble || "", frame: local.equipped?.frame || remote.equipped?.frame || "" },
    plays: Math.max(local.plays || 0, remote.plays || 0),
    bond: maxTable(local.bond, remote.bond),
    best: maxTable(local.best, remote.best),
    streak: { count: streak.count || 0, last: streak.last || "" },
    bestStreak: Math.max(local.bestStreak || 0, remote.bestStreak || 0, streak.count || 0),
    badges: [...new Set([...(local.badges || []), ...(remote.badges || [])])],
    memory: { ...(remote.memory || {}), ...(local.memory || {}) }, // the note this device just wrote wins
    social: { comments: Math.max(local.social?.comments || 0, remote.social?.comments || 0), loves: Math.max(local.social?.loves || 0, remote.social?.loves || 0) },
  };
}

// Replace what is saved here with `p` (after a merge). Does not call the change listeners.
export function replace(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

// Candles left to spend. `candles` only ever counts what was earned (so the larger value wins when two devices sync),
// and `spent` only ever grows for the same reason.
export const balance = (p) => Math.max(0, (p.candles || 0) - (p.spent || 0));

// Save `p` and tell the listeners (the account code copies it to the server).
export const saveProgress = (p) => save(p);

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

// Pay every quest that today's counters have just completed, bonus and streak included. Changes `p`.
function settleQuests(p, characters) {
  const quests = todaysQuests(characters);
  const d = p.daily;
  const completed = quests.filter((q) => !d.done.includes(q.id) && questProgress(q, d) >= q.target);
  for (const q of completed) d.done.push(q.id);
  let candles = completed.reduce((sum, q) => sum + q.reward, 0);
  const allDone = completed.length > 0 && !d.done.includes("all") && quests.every((q) => d.done.includes(q.id));
  if (allDone) {
    d.done.push("all");
    candles += ALL_DONE_BONUS;
  }
  p.candles += candles;
  // the first finished quest of a day keeps (or starts) the streak
  if (completed.length && p.streak.last !== today()) {
    p.streak = { count: p.streak.last === yesterday() ? p.streak.count + 1 : 1, last: today() };
    p.bestStreak = Math.max(p.bestStreak || 0, p.streak.count);
  }
  return { completed, questCandles: candles, allDone, streak: p.streak.count };
}

// Bond level 8 with a ghost gives her ribbon frame (free; worn from the shop on the Me page). Changes `p`.
export const RIBBON_LEVEL = 8;
function grantBondRewards(p) {
  for (const [id, xp] of Object.entries(p.bond)) {
    const frame = `frame-ribbon-${id}`;
    if (levelOf(xp) >= RIBBON_LEVEL && /^[1-4]$/.test(id) && !p.owned.includes(frame)) p.owned.push(frame);
  }
}

// Book the result of one game run. Returns what to show the player.
// `perCandle` is how many points make one candle in this game (games.json `scorePerCandle`; gentle games score lower).
export function recordRun(game, charId, score, characters, perCandle = SCORE_PER_CANDLE) {
  const p = load();
  const wanted = Math.min(MAX_CANDLES_PER_RUN, Math.floor(score / perCandle));
  const candles = Math.min(wanted, Math.max(0, DAILY_CANDLE_CAP - p.daily.candles));
  const hosted = hostOf() === charId; // this week's host: double bond XP in her games, and her themed quest
  const xp = (5 + candles * 2) * (hosted ? 2 : 1); // playing always grows the bond a little
  const levelBefore = levelOf(p.bond[charId] || 0);
  p.candles += candles;
  p.daily.candles += candles;
  p.bond[charId] = (p.bond[charId] || 0) + xp;
  const prevBest = p.best[game] || 0;
  const newBest = score > prevBest;
  if (newBest) p.best[game] = score;
  p.plays += 1;
  p.daily.plays += 1;
  p.daily.topScore = Math.max(p.daily.topScore, score);
  p.daily.bondXp += xp;
  const quests = settleQuests(p, characters);
  let weeklyReward = 0;
  if (hosted) {
    p.weekly.plays += 1;
    if (p.weekly.plays >= WEEKLY_TARGET && !p.weekly.done) { p.weekly.done = true; weeklyReward = WEEKLY_REWARD; p.candles += weeklyReward; }
  }
  const badges = settleBadges(p, LEVELS);
  grantBondRewards(p);
  save(p);
  return {
    hosted, weeklyReward, badges, candles, xp, newBest, best: Math.max(prevBest, score), capped: candles < wanted,
    levelBefore, levelAfter: levelOf(p.bond[charId]), ...quests,
  };
}

// A message sent to a ghost: a little bond XP (up to a daily cap per ghost) and progress on the quests.
// A comment posted or a whisper loved (counts toward badges). Returns the badges earned by it.
export function recordSocial(kind) {
  const p = load();
  p.social = { comments: 0, loves: 0, ...(p.social || {}) };
  if (kind in p.social) p.social[kind] += 1;
  const badges = settleBadges(p, LEVELS);
  save(p);
  return badges;
}

export function recordChat(charId, characters) {
  const p = load();
  const d = p.daily;
  d.messages += 1;
  d.chatWith[charId] = (d.chatWith[charId] || 0) + 1;
  const xp = Math.min(CHAT_XP_PER_MESSAGE, Math.max(0, DAILY_CHAT_XP_CAP - (d.chatXp[charId] || 0)));
  const levelBefore = levelOf(p.bond[charId] || 0);
  if (xp) {
    p.bond[charId] = (p.bond[charId] || 0) + xp;
    d.chatXp[charId] = (d.chatXp[charId] || 0) + xp;
    d.bondXp += xp;
  }
  const quests = settleQuests(p, characters);
  const badges = settleBadges(p, LEVELS);
  grantBondRewards(p);
  save(p);
  return { badges, xp, levelBefore, levelAfter: levelOf(p.bond[charId] || 0), ...quests };
}
