import test from "node:test";
import assert from "node:assert/strict";
import { dailySet, LINES, IDS, answerPoints, scoreRun } from "../assets/scripts/games/guess-the-ghost.js";

test("dailySet is deterministic per date and varies across dates", () => {
  assert.deepEqual(dailySet("2026-05-01"), dailySet("2026-05-01"));
  const keys = (d) => dailySet(d).map((q) => q.key).join();
  assert.notEqual(keys("2026-05-01"), keys("2026-05-02"));
});

test("dailySet has 10 distinct questions", () => {
  for (const d of ["2026-01-01", "2026-05-01", "2027-12-31"]) {
    const s = dailySet(d);
    assert.equal(s.length, 10);
    assert.equal(new Set(s.map((q) => q.key)).size, 10);
    for (const q of s) assert.ok(IDS.includes(q.ghost) && q.en && q.id);
  }
});

test("bank has >= 14 EN and ID lines per ghost, short, no repeats", () => {
  const seen = new Set();
  for (const g of IDS) {
    assert.ok(LINES[g].length >= 14);
    for (const l of LINES[g]) {
      assert.ok(l.en && l.id);
      assert.ok(l.en.length <= 95 && l.id.length <= 95, l.en);
      assert.ok(!seen.has(l.en)); seen.add(l.en);
      assert.ok(!/\b(saya|anda|bot|AI)\b/.test(l.id + " " + l.en));
    }
  }
});

test("scoring and streak bonus", () => {
  assert.equal(answerPoints(false, 5), 0);
  assert.equal(answerPoints(true, 0), 10);
  assert.equal(answerPoints(true, 1), 12);
  assert.equal(answerPoints(true, 9), 20);
  const qs = dailySet("2026-05-01");
  assert.equal(scoreRun(qs, qs.map((q) => q.ghost)), 170);
  assert.equal(scoreRun(qs, qs.map(() => "x")), 0);
  const picks = qs.map((q) => q.ghost); picks[2] = "x";
  assert.equal(scoreRun(qs, picks), 10 + 12 + 0 + 10 + 12 + 14 + 16 + 18 + 20 + 20);
});
