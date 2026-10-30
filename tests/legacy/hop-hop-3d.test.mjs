import test from "node:test";
import assert from "node:assert/strict";
import { planRow, spawnAhead, collides, createEngine, scoreOf, speedAt, rowGap, LANE_W, SPEED0, SPEED_MAX, KINDS, HOP_V, GRAV } from "../assets/scripts/games/hop-hop-3d.js";

const seeded = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test("every row leaves a free lane and only uses known kinds", () => {
  const rng = seeded(1);
  for (let i = 0; i < 2000; i++) {
    const row = planRow(rng, SPEED0 + (i % 12));
    assert.equal(row.length, 3);
    assert.ok(row.some((k) => k === null), "free lane");
    assert.ok(row.some((k) => k !== null), "at least one obstacle");
    for (const k of row) assert.ok(k === null || k in KINDS);
  }
});

test("spawning is deterministic with the same rng, ordered, and respects the horizon", () => {
  const run = () => { const st = { next: 30 }; const out = []; spawnAhead(st, 300, SPEED0, seeded(7), out); return { st, out }; };
  const a = run(), b = run();
  assert.deepEqual(a.out, b.out);
  assert.ok(a.out.length > 10);
  assert.ok(a.out.every((o) => o.d <= 300));
  for (let i = 1; i < a.out.length; i++) assert.ok(a.out[i].d >= a.out[i - 1].d);
  assert.ok(a.st.next > 300);
});

test("row gap is about 1.1 to 1.8 seconds of travel", () => {
  assert.equal(rowGap(10, () => 0), 11);
  assert.ok(Math.abs(rowGap(10, () => 1) - 18) < 1e-9);
});

test("collision: tomb hit on the ground, cleared by a hop", () => {
  const o = { d: 50, lane: 0, kind: "tomb" };
  assert.equal(collides({ x: 0, y: 0, d: 50 }, o), true);
  assert.equal(collides({ x: 0, y: 0, d: 49.5 }, o), true);
  assert.equal(collides({ x: 0, y: 0, d: 48 }, o), false);
  assert.equal(collides({ x: 0, y: 1, d: 50 }, o), false);
  assert.equal(collides({ x: LANE_W, y: 0, d: 50 }, o), false);
});

test("collision: a branch is walked under but hit by a hop", () => {
  const o = { d: 50, lane: 1, kind: "branch" };
  assert.equal(collides({ x: LANE_W, y: 0, d: 50 }, o), false);
  assert.equal(collides({ x: LANE_W, y: 0.5, d: 50 }, o), true);
  assert.equal(collides({ x: 0, y: 0.5, d: 50 }, o), false);
});

test("score scale and speed curve", () => {
  assert.equal(scoreOf(0), 0);
  assert.equal(scoreOf(8), 10);
  assert.equal(scoreOf(-5), 0);
  assert.equal(speedAt(0), SPEED0);
  assert.equal(speedAt(1e6), SPEED_MAX);
  // a 50 second run lands in the 2D game's "good run" range
  const e = createEngine({ rng: seeded(3) });
  e.obs = []; e.spawn.next = 1e9;
  for (let i = 0; i < 50 * 60; i++) e.step(1 / 60);
  assert.ok(e.score > 400 && e.score < 1500, `score ${e.score}`);
});

test("hop physics: lands after about 0.7 s and cannot double hop", () => {
  const e = createEngine({ rng: seeded(1) });
  e.spawn.next = 1e9;
  assert.equal(e.hop(), true);
  e.step(1 / 60);
  assert.equal(e.hop(), false);
  let t = 1 / 60, peak = 0;
  while (e.y > 0 || e.vy !== 0) { e.step(1 / 60); t += 1 / 60; peak = Math.max(peak, e.y); }
  assert.ok(Math.abs(t - (2 * HOP_V) / GRAV) < 0.05, `air time ${t}`);
  assert.ok(peak > 1.1 && peak < 1.3);
});

test("lane changes are clamped and the player slides over", () => {
  const e = createEngine({ rng: seeded(1) });
  e.spawn.next = 1e9;
  e.moveLane(-1); e.moveLane(-1); e.moveLane(-1);
  assert.equal(e.lane, -1);
  for (let i = 0; i < 30; i++) e.step(1 / 60);
  assert.ok(Math.abs(e.x + LANE_W) < 1e-6);
});

test("standing still ends the run on a collision, and the engine freezes", () => {
  const e = createEngine({ rng: seeded(5) });
  for (let i = 0; i < 60 * 120 && !e.over; i++) e.step(1 / 60);
  assert.equal(e.over, true);
  const d = e.d, s = e.score;
  e.step(1); e.hop(); e.moveLane(1);
  assert.equal(e.d, d);
  assert.equal(e.score, s);
});

test("a big frame does not tunnel through an obstacle", () => {
  const e = createEngine({ rng: seeded(1) });
  e.spawn.next = 1e9;
  e.speed = 19; e.t = 1000;
  e.obs.push({ d: e.d + 0.5, lane: 0, kind: "tomb" });
  e.step(0.1);
  assert.equal(e.over, true);
});

test("culls obstacles left behind and keeps spawning ahead", () => {
  const e = createEngine({ rng: seeded(9) });
  e.lane = 0;
  e.over = false;
  for (let i = 0; i < 600; i++) { e.step(1 / 60); e.over = false; }
  assert.ok(e.obs.every((o) => o.d > e.d - 4));
  assert.ok(e.obs.some((o) => o.d > e.d + 20));
  assert.ok(e.obs.length < 40);
});
