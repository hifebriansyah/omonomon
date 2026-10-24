// Pure functions of the API Worker. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { cleanProgress, mergeProgress, weekStart, sameSecret } from "../worker/api.js";

test("weekStart is the Monday of the week (UTC)", () => {
  assert.equal(weekStart(Date.UTC(2026, 9, 25)), "2026-10-19"); // a Sunday
  assert.equal(weekStart(Date.UTC(2026, 9, 26)), "2026-10-26"); // a Monday
  assert.equal(weekStart(Date.UTC(2026, 9, 19, 23, 59)), "2026-10-19");
});

test("sameSecret", () => {
  assert.equal(sameSecret("abc", "abc"), true);
  assert.equal(sameSecret("abc", "abd"), false);
  assert.equal(sameSecret("abc", "ab"), false);
  assert.equal(sameSecret("", ""), false);
  assert.equal(sameSecret(undefined, "x"), false);
});

test("cleanProgress drops what the game never writes", () => {
  const p = cleanProgress({ candles: -5, plays: 3.7, spent: 2e9, bond: { 1: 50, bad: 9 }, best: { "hop-hop": 10, "BAD KEY": 1 }, badges: ["a-b", "NO!", "a-b"], owned: ["stage-stars"], equipped: { stage: "stage-stars", bubble: "<x>" } });
  assert.equal(p.candles, 0);
  assert.equal(p.plays, 3);
  assert.equal(p.spent, 1_000_000);
  assert.deepEqual(p.bond, { 1: 50 });
  assert.deepEqual(p.best, { "hop-hop": 10 });
  assert.deepEqual(p.badges, ["a-b"]);
  assert.deepEqual(p.owned, ["stage-stars"]);
  assert.deepEqual(p.equipped, { stage: "stage-stars", bubble: "", frame: "" });
});

test("mergeProgress: the larger number wins, lists join, the newer device look wins", () => {
  const a = cleanProgress({ candles: 100, spent: 20, bond: { 1: 10 }, best: { x: 5 }, badges: ["a"], owned: ["o1"], equipped: { stage: "s1" } });
  const b = cleanProgress({ candles: 50, spent: 40, bond: { 1: 30, 2: 5 }, best: { x: 3 }, badges: ["b"], owned: ["o2"], equipped: { stage: "s2" } });
  const m = mergeProgress(a, b);
  assert.equal(m.candles, 100);
  assert.equal(m.spent, 40);
  assert.deepEqual(m.bond, { 1: 30, 2: 5 });
  assert.deepEqual(m.best, { x: 5 });
  assert.deepEqual(m.badges.sort(), ["a", "b"]);
  assert.deepEqual(m.owned.sort(), ["o1", "o2"]);
  assert.equal(m.equipped.stage, "s2");
});
