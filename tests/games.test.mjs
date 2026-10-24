// The rules of the games and the progress model, away from the page. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { todaysQuests, questProgress } from "../assets/scripts/games/quests.js";
import { settleBadges, BADGES } from "../assets/scripts/games/achievements.js";
import { createEngine } from "../assets/scripts/games/rounds.js";
import { merge, levelOf, LEVELS, balance } from "../assets/scripts/games/progress.js";

const chars = ["1", "2", "3", "4"].map((id) => ({ id }));

test("quests: three a day, the same for the same date", () => {
  const a = todaysQuests(chars, "2026-10-25");
  assert.equal(a.length, 3);
  assert.deepEqual(a, todaysQuests(chars, "2026-10-25"));
  assert.equal(questProgress({ kind: "plays" }, { plays: 2 }), 2);
});

test("badges are earned once and kept", () => {
  const p = { plays: 12, best: {}, bond: {}, candles: 0, bestStreak: 0 };
  const first = settleBadges(p, LEVELS);
  assert.ok(first.includes("first-run") && first.includes("plays-10"));
  assert.deepEqual(settleBadges(p, LEVELS), []);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
});

test("night rounds: a tapped call scores, a missed call costs a life", () => {
  const e = createEngine({ rng: () => 0, lives: 1 });
  let lit = null;
  for (let i = 0; i < 40 && lit === null; i++) lit = e.tick(0.1).find((ev) => ev.type === "lit")?.i ?? null;
  assert.notEqual(lit, null);
  assert.equal(e.tap(lit)[0].type, "ok");
  assert.ok(e.state().score >= 10);
  let over = false;
  for (let i = 0; i < 400 && !over; i++) over = e.tick(0.1).some((ev) => ev.type === "over");
  assert.equal(over, true);
});

test("progress: merge keeps the larger values, the union of lists", () => {
  const m = merge(
    { candles: 10, spent: 0, plays: 1, bond: { 1: 5 }, best: {}, badges: ["a"], owned: [], equipped: {}, streak: { count: 1, last: "2026-10-24" } },
    { candles: 30, spent: 5, plays: 0, bond: { 1: 9 }, best: {}, badges: ["b"], owned: ["x"], equipped: { stage: "s" }, streak: { count: 2, last: "2026-10-25" } },
  );
  assert.equal(m.candles, 30);
  assert.equal(m.bond[1], 9);
  assert.deepEqual(m.badges.sort(), ["a", "b"]);
  assert.equal(m.streak.count, 2);
  assert.equal(balance(m), 25);
  assert.equal(levelOf(LEVELS[3]), 4);
});
