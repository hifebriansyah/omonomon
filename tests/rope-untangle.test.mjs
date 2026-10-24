import test from "node:test";
import assert from "node:assert/strict";
import { segmentsCross, countCrossings, makeLevel, knotsFor, solveScore, createRun } from "../assets/scripts/games/rope-untangle.js";

const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

test("segmentsCross: X crosses, parallel and shared knot do not", () => {
  assert.ok(segmentsCross({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }));
  assert.ok(!segmentsCross({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }));
  assert.ok(!segmentsCross({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }));
});

test("countCrossings ignores ropes sharing a knot", () => {
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }];
  assert.equal(countCrossings(pts, [[0, 1], [2, 3]]), 2);
  assert.equal(countCrossings(pts, [[0, 1], [1, 2]]), 0);
});

test("levels have the right size, are solvable and start tangled", () => {
  for (let lv = 0; lv < 8; lv++) {
    const n = knotsFor(lv);
    for (let s = 1; s <= 10; s++) {
      const g = makeLevel(n, seeded(lv * 100 + s));
      assert.equal(g.pts.length, n);
      assert.equal(g.solution.length, n);
      assert.ok(g.edges.length >= n - 1 && g.edges.length <= 3 * n - 6);
      assert.equal(countCrossings(g.solution, g.edges), 0);
      assert.ok(countCrossings(g.pts, g.edges) > 0);
    }
  }
});

test("knotsFor grows and solveScore is an integer", () => {
  assert.equal(knotsFor(0), 5);
  assert.ok(knotsFor(3) > knotsFor(1));
  assert.equal(solveScore(30), 80);
  assert.equal(solveScore(-3), 20);
  assert.ok(Number.isInteger(solveScore(12.7)));
});

test("run: solving scores, skipping costs 5 (min 0), run ends at 90 s", () => {
  const r = createRun({ rng: seeded(7) });
  assert.equal(r.skip(), 0);
  assert.equal(r.state().score, 0);
  const g = r.state().g;
  g.solution.forEach((p, i) => r.move(i, p.x, p.y));
  r.tick(10);
  assert.equal(r.finish(), 20 + 2 * 20);
  assert.equal(r.state().level, 2);
  r.skip();
  assert.ok(r.state().score >= 0 && Number.isInteger(r.state().score));
  r.tick(100);
  assert.ok(r.state().over);
  assert.equal(r.state().t, 90);
});
