import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../assets/scripts/games/haunted-house.js";

const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

test("circle vs box collision pushes out and keeps clear", () => {
  const b = G.box(-1, 1, -1, 1);
  assert.equal(G.pushOut(3, 0, 0.3, b), null);
  const p = G.pushOut(1.1, 0, 0.3, b);
  assert.ok(Math.abs(p.x - 1.3) < 1e-9 && p.z === 0);
  const inside = G.pushOut(0.9, 0, 0.3, b); // centre inside: leaves by the nearest side
  assert.ok(inside.x >= 1.3 - 1e-9);
  let m = { x: 0, z: 4 };
  for (let i = 0; i < 20; i++) m = G.movePlayer(m, 0, 0.1, G.WALLS);
  assert.ok(m.z <= 5 - G.PLAYER_R + 1e-9);
});

test("layouts: items clear of props, walls, each other; deterministic with a seed", () => {
  for (let seed = 1; seed < 40; seed++) {
    const run = G.createRun(seeded(seed));
    run.layouts.forEach((lay, i) => {
      assert.equal(lay.kind, G.KINDS[i]);
      assert.equal(lay.items.length, lay.kind === "secrets" ? 5 : lay.kind === "petals" ? 3 : lay.kind === "lanterns" ? 4 : 5);
      for (const it of lay.items) {
        assert.ok(Math.abs(it.x) <= 4.3 && Math.abs(it.z) <= 4.3);
        for (const b of lay.props) assert.ok(!G.circleHitsBox(it.x, it.z, 0.3, b), `seed ${seed} room ${i}`);
      }
      assert.equal(new Set(lay.items.map((it) => it.id)).size, lay.items.length);
    });
  }
  assert.deepEqual(G.makeRoom(0, seeded(7)), G.makeRoom(0, seeded(7)));
});

test("items puzzle", () => {
  const lay = G.makeRoom(0, seeded(3));
  const p = G.createPuzzle(lay);
  assert.equal(p.touch("nope"), "ignore");
  lay.items.forEach((it, i) => { assert.equal(p.touch(it.id), "ok"); assert.equal(p.count(), i + 1); });
  assert.ok(p.done());
  const q = G.createPuzzle(lay);
  q.touch("i0");
  assert.equal(q.touch("i0"), "repeat");
  assert.equal(q.visible("i0"), false);
});

test("lantern puzzle needs the order, a mistake resets", () => {
  const lay = G.makeRoom(1, seeded(5));
  assert.equal(new Set(lay.order).size, 4);
  const p = G.createPuzzle(lay);
  assert.equal(p.touch(lay.order[0]), "ok");
  assert.equal(p.touch(lay.order[0]), "repeat");
  assert.equal(p.touch(lay.order[2]), "wrong");
  assert.equal(p.count(), 0);
  assert.equal(p.found(lay.order[0]), false);
  lay.order.forEach((id) => assert.equal(p.touch(id), "ok"));
  assert.ok(p.done());
});

test("petals go in order, only the next is visible", () => {
  const lay = G.makeRoom(2, seeded(9));
  const p = G.createPuzzle(lay);
  assert.deepEqual(lay.items.map((i) => p.visible(i.id)), [true, false, false]);
  assert.equal(p.touch("p1"), "ignore");
  assert.equal(p.touch("p0"), "ok");
  assert.equal(p.touch("p0"), "repeat");
  assert.equal(p.visible("p1"), true);
  p.touch("p1"); p.touch("p2");
  assert.ok(p.done());
});

test("secrets: three whisper, decoys are empty", () => {
  const lay = G.makeRoom(3, seeded(11));
  const p = G.createPuzzle(lay);
  assert.equal(p.touch("mirror"), "empty");
  assert.equal(p.touch("table"), "empty");
  assert.equal(p.count(), 0);
  for (const id of ["wardrobe", "shelf", "trunk"]) assert.equal(p.touch(id), "ok");
  assert.ok(p.done());
  assert.equal(lay.boxes.length, 4 + 5);
});

test("scoreOf bounds", () => {
  assert.equal(G.scoreOf(0, 10), 0);
  assert.equal(G.scoreOf(2, 10), 50);
  assert.equal(G.scoreOf(4, 30), 150);
  assert.equal(G.scoreOf(4, 60), 150);
  assert.equal(G.scoreOf(4, 120), 125);
  assert.equal(G.scoreOf(4, 180), 100);
  assert.equal(G.scoreOf(4, 999), 100);
});

test("a full run: rooms, exit, score, char", () => {
  const run = G.createRun(seeded(21));
  const solve = () => {
    const lay = run.layout;
    const ids = lay.kind === "lanterns" ? lay.order : lay.kind === "secrets" ? ["wardrobe", "shelf", "trunk"] : lay.items.map((i) => i.id);
    let last;
    for (const id of ids) last = run.touch(id);
    return last;
  };
  for (let r = 0; r < 3; r++) {
    assert.equal(run.canExit(), false);
    assert.equal(solve().roomDone, true);
    assert.equal(run.canExit(), true);
    assert.equal(run.touch("i0").result, "ignore");
    assert.ok(run.next());
  }
  assert.equal(run.next(), false);
  run.tick(90);
  const end = solve();
  assert.ok(end.runDone && run.over);
  assert.equal(run.lastChar(), "4");
  assert.equal(run.score(), G.scoreOf(4, 90));
  run.tick(50);
  assert.equal(run.time, 90);
});

test("leaving early scores rooms so far and names the room's ghost", () => {
  const run = G.createRun(seeded(2));
  run.layout.items.forEach((i) => run.touch(i.id));
  run.next();
  run.tick(30);
  run.leave();
  assert.equal(run.score(), 25);
  assert.equal(run.lastChar(), "2");
});
