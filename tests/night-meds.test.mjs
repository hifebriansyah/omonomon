import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../assets/scripts/games/night-meds.js";

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
// rng values: 0 -> tray 0, 0.4 -> tray 1, 0.9 -> tray 2
const spawn = (e) => { for (let k = 0; k < 100 && !e.state().pill; k++) e.tick(0.1); return e.state().pill; };
const fallToZone = (e) => { while (e.state().pill.p < 0.4) e.tick(0.05); };
const sortRight = (e) => { spawn(e); fallToZone(e); return e.choose(e.state().pill.kind); };

test("correct tray scores 10", () => {
  const e = createEngine({ rng: seq(0) });
  const ev = sortRight(e);
  assert.equal(ev[0].type, "ok");
  assert.equal(e.state().score, 10);
  assert.equal(e.state().pill, null);
});

test("choosing before the drop zone does nothing", () => {
  const e = createEngine({ rng: seq(0) });
  spawn(e);
  assert.equal(e.choose(0)[0].type, "idle");
  assert.ok(e.state().pill);
});

test("wrong tray costs a life and breaks the streak", () => {
  const e = createEngine({ rng: seq(0) });
  sortRight(e);
  spawn(e); fallToZone(e);
  const ev = e.choose(2);
  assert.equal(ev[0].type, "wrong");
  assert.equal(e.state().lives, 2);
  assert.equal(e.state().streak, 0);
  assert.equal(e.state().score, 10);
});

test("missed pill costs a life", () => {
  const e = createEngine({ rng: seq(0) });
  spawn(e);
  let missed = false;
  for (let k = 0; k < 200 && !missed; k++) missed = e.tick(0.1).some((x) => x.type === "miss");
  assert.ok(missed);
  assert.equal(e.state().lives, 2);
});

test("streak of 5 pays 15", () => {
  const e = createEngine({ rng: seq(0, 0.4, 0.9) });
  for (let k = 0; k < 4; k++) sortRight(e);
  assert.equal(e.state().score, 40);
  assert.equal(sortRight(e)[0].gain, 15);
  assert.equal(e.state().score, 55);
});

test("three losses end the run once; nothing happens after", () => {
  const e = createEngine({ rng: seq(0) });
  let overs = 0;
  for (let k = 0; k < 3; k++) {
    spawn(e); fallToZone(e);
    overs += e.choose(1).filter((x) => x.type === "over").length;
  }
  assert.equal(e.state().over, true);
  assert.equal(overs, 1);
  assert.deepEqual(e.tick(5), []);
  assert.equal(e.choose(0)[0].type, "idle");
});

test("pills fall faster over time", () => {
  const e = createEngine({ rng: seq(0) });
  const first = spawn(e).fall;
  for (let k = 0; k < 1200; k++) { const s = e.state(); if (s.pill) { s.pill.p = 0.5; e.choose(s.pill.kind); } e.tick(0.1); }
  const later = spawn(e).fall;
  assert.ok(later < first, `${later} < ${first}`);
  assert.ok(later >= 1.1);
});

test("deterministic with a fixed rng", () => {
  const run = () => {
    const e = createEngine({ rng: seq(0.1, 0.5, 0.8, 0.3) });
    const log = [];
    for (let k = 0; k < 300; k++) log.push(e.tick(0.1).map((x) => x.type + (x.kind ?? "")).join());
    return JSON.stringify([log, e.state()]);
  };
  assert.equal(run(), run());
});
