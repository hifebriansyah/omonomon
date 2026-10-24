import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../assets/scripts/games/tree-gossip.js";

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
// rng 0.99 -> secret (not a decoy), picks last free spot; 0.0 -> decoy, first spot
const spawn = (e) => e.tick(2).find((x) => x.type === "show");

test("secret tap scores 10", () => {
  const e = createEngine({ rng: seq(0.99, 0.5) });
  const s = spawn(e);
  assert.equal(s.kind, "secret");
  const r = e.tap(s.i);
  assert.equal(r[0].gain, 10);
  assert.equal(e.state().score, 10);
});

test("streak of 5 gives 15", () => {
  const e = createEngine({ rng: () => 0.99 });
  const gains = [];
  for (let n = 0; n < 6; n++) {
    const s = spawn(e);
    gains.push(e.tap(s.i)[0].gain);
  }
  assert.deepEqual(gains, [10, 10, 10, 10, 15, 15]);
});

test("missed secret breaks streak at no cost", () => {
  const e = createEngine({ rng: () => 0.99 });
  e.tap(spawn(e).i);
  const s = spawn(e);
  e.tick(5);
  assert.equal(e.state().streak, 0);
  assert.equal(e.state().lives, 3);
});

test("decoy costs a life and three ends the run", () => {
  const e = createEngine({ rng: () => 0 });
  let over = false;
  for (let n = 0; n < 3; n++) {
    const s = spawn(e);
    assert.ok(s.kind === "crow" || s.kind === "bat");
    over = e.tap(s.i).some((x) => x.type === "over");
  }
  assert.ok(over);
  assert.equal(e.state().lives, 0);
  assert.equal(e.state().over, true);
  assert.deepEqual(e.tick(1), []);
  assert.deepEqual(e.tap(0), []);
});

test("tapping an empty spot is free", () => {
  const e = createEngine({ rng: () => 0.99 });
  assert.equal(e.tap(0)[0].type, "idle");
  assert.equal(e.state().score, 0);
  assert.equal(e.state().lives, 3);
});

test("decoy that hides un-tapped costs nothing and keeps streak", () => {
  const e = createEngine({ rng: () => 0.99 });
  e.tap(spawn(e).i);
  const st = e.state();
  st.spots[0] = { kind: "crow", deadline: st.t + 0.5, window: 0.5 };
  e.tick(1);
  assert.equal(st.lives, 3);
  assert.equal(st.streak, 1);
});

test("speeds up: more peekers at once and shorter windows", () => {
  const early = createEngine({ rng: () => 0.99 });
  const w0 = spawn(early).window;
  const late = createEngine({ rng: () => 0.99 });
  late.state().t = 70;
  late.state().nextAt = 0;
  let shows = 0;
  for (let n = 0; n < 4; n++) {
    late.state().nextAt = 0;
    shows += late.tick(0.001).filter((x) => x.type === "show").length;
  }
  assert.equal(shows, 4);
  const w1 = late.state().spots.find((s) => s.kind).window;
  assert.ok(w1 < w0);
  const one = createEngine({ rng: () => 0.99 });
  one.tick(1);
  one.state().nextAt = 0;
  assert.equal(one.tick(0.001).filter((x) => x.type === "show").length, 0);
});

test("deterministic with a fixed rng", () => {
  const run = () => {
    let a = 12345;
    const rng = () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; };
    const e = createEngine({ rng });
    const log = [];
    for (let n = 0; n < 200; n++) {
      log.push(e.tick(0.1));
      const up = e.state().spots.findIndex((s) => s.kind === "secret");
      if (up >= 0 && n % 3 === 0) log.push(e.tap(up));
    }
    return JSON.stringify([log, e.state()]);
  };
  assert.equal(run(), run());
});
