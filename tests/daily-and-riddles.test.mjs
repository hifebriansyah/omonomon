import test from "node:test";
import assert from "node:assert/strict";
import { makeRng, seedOf, todaysPick, dateString } from "../assets/scripts/games/daily.js";
import { dailyRiddles, matches, normalize, RIDDLES } from "../assets/scripts/games/ghost-riddles.js";
import { hostOf, weekOf } from "../assets/scripts/games/event.js";

test("daily: the same seed gives the same sequence, the pick follows the date", () => {
  const a = makeRng(seedOf("2026-10-25")), b = makeRng(seedOf("2026-10-25"));
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(makeRng(seedOf("2026-10-26"))(), makeRng(seedOf("2026-10-25"))());
  assert.equal(todaysPick("2026-10-25").game, todaysPick("2026-10-25").game);
  assert.match(dateString(new Date(2026, 9, 5)), /^2026-10-05$/);
});

test("ghost riddles: three riddles from three different ghosts, the same all day", () => {
  const r = dailyRiddles("2026-10-25");
  assert.equal(r.length, 3);
  assert.equal(new Set(r.map((x) => x.ghost)).size, 3);
  assert.deepEqual(r, dailyRiddles("2026-10-25"));
  assert.ok(RIDDLES.every((x) => x.en && x.id && x.answers.length >= 2));
});

test("ghost riddles: answers match loosely", () => {
  const egg = RIDDLES.find((x) => x.answers.includes("egg"));
  assert.equal(matches(egg, " Egg! "), true);
  assert.equal(matches(egg, "TELUR"), true);
  assert.equal(matches(egg, "chicken"), false);
  assert.equal(normalize("Café  Éclair!"), "cafe eclair");
});

test("event: one host a week, from the Monday", () => {
  assert.equal(weekOf(Date.UTC(2026, 9, 25)), "2026-10-19");
  assert.equal(hostOf(Date.UTC(2026, 9, 20)), hostOf(Date.UTC(2026, 9, 25)));
  assert.notEqual(hostOf(Date.UTC(2026, 9, 20)), hostOf(Date.UTC(2026, 9, 27)));
});
