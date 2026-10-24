import test from "node:test";
import assert from "node:assert/strict";
import { createEngine, spawnRow, hit, scoreOf, FINISH, XMAX, FLAMES } from "../assets/scripts/games/lantern-flight.js";

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test("spawnRow is deterministic and stays in bounds", () => {
  assert.deepEqual(spawnRow(seeded(3), 10), spawnRow(seeded(3), 10));
  const rng = seeded(11);
  for (let i = 0; i < 200; i++) {
    const row = spawnRow(rng, i * 4);
    assert.ok(row.filter((o) => o.kind !== "wish").length <= 1);
    for (const o of row) { assert.ok(Math.abs(o.x) <= XMAX + 0.01); assert.ok(o.y >= i * 4); }
  }
});

test("hit is a circle overlap test", () => {
  assert.ok(hit({ x: 0, y: 0, r: 1 }, { x: 1.5, y: 0, r: 1 }));
  assert.ok(!hit({ x: 0, y: 0, r: 1 }, { x: 2.5, y: 0, r: 1 }));
});

test("scoreOf adds the moon bonus", () => { assert.equal(scoreOf(4, false), 40); assert.equal(scoreOf(4, true), 90); });

test("a wish adds 10 and a hazard costs a flame once per invulnerable window", () => {
  const e = createEngine({ rng: () => 0.99 });
  const s = e.state();
  s.items.push({ kind: "wish", x: 0, y: 0.05, r: 0.3, vx: 0 }, { kind: "kite", x: 0, y: 0.05, r: 0.4, vx: 0 }, { kind: "kite", x: 0, y: 0.06, r: 0.4, vx: 0 });
  const ev = e.step(0.05, false);
  assert.ok(ev.includes("wish") && ev.includes("hit"));
  assert.equal(s.score, 10);
  assert.equal(s.flames, FLAMES - 1);
});

test("running out of flames ends the run; reaching the moon gives +50", () => {
  const e = createEngine({ rng: () => 0.99 });
  const s = e.state();
  s.flames = 1;
  s.items.push({ kind: "branch", x: 0, y: 0.05, r: 0.7, vx: 0 });
  assert.ok(e.step(0.05, true).includes("out"));
  assert.equal(s.done, "out");
  assert.deepEqual(e.step(0.05, true), []);

  const m = createEngine({ rng: () => 0.99 });
  m.state().y = FINISH - 0.01;
  m.state().wishes = 3;
  assert.ok(m.step(0.1, false).includes("moon"));
  assert.equal(m.state().score, 80);
});

test("a full run with no steering stays within the score cap", () => {
  const e = createEngine({ rng: seeded(5) });
  let n = 0;
  while (!e.state().done && n++ < 20000) e.step(1 / 30, (n >> 5) % 2 === 0);
  assert.ok(e.state().score <= 700);
  assert.ok(e.state().done);
});
