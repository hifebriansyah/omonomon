import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../assets/scripts/games/memory-garden.js";

const B = (rows) => rows.map((r) => r.split("").map(Number));

test("findMatches finds rows, columns and ignores pairs", () => {
  const b = B(["0012340", "1203412", "3401234", "2310432", "4123041", "0431204", "1234012"]);
  assert.equal(G.findMatches(b).size, 0);
  const m = G.findMatches(B(["1110000", "0000000", "0000000", "0000000", "0000000", "0000000", "0000000"]).map((r, i) => r.map((v, j) => (i === 0 ? v : (i * 2 + j * 3 + (i > 2 ? 1 : 0)) % 5))));
  assert.ok(m.has("0,0") && m.has("0,1") && m.has("0,2"));
  const col = B(["2000000", "2000000", "2000000"]);
  assert.equal(G.findMatches(col).size >= 3, true);
});

test("swap validity", () => {
  const b = B(["0100000", "1010000", "2222222", "3434343", "4343434", "3434343", "4343434"]);
  b[2] = [2, 3, 2, 3, 2, 3, 2].slice();
  b[0] = [1, 1, 0, 1, 2, 3, 4];
  assert.ok(G.isValidSwap(b, { r: 0, c: 2 }, { r: 0, c: 3 }));
  assert.ok(!G.isValidSwap(b, { r: 0, c: 0 }, { r: 1, c: 1 }), "not adjacent");
  const same = B(["0011001", "2200112", "0011001", "2200112", "0011001", "2200112", "0011001"]);
  assert.equal(G.findMatches(same).size, 0);
  assert.ok(!G.isValidSwap(same, { r: 0, c: 0 }, { r: 0, c: 1 }), "swapping equal petals changes nothing");
});

test("gravity drops and refills with no nulls", () => {
  const b = G.createBoard(G.makeRng(3));
  b[6][0] = null; b[5][0] = null; b[0][2] = null;
  const g = G.gravity(b, G.makeRng(9));
  assert.ok(g.flat().every((v) => Number.isInteger(v) && v >= 0 && v < G.KINDS));
  assert.equal(g[6][0], b[4][0]);
});

test("scoring: 10 per petal, cascade multiplier grows", () => {
  const base = G.createBoard(G.makeRng(5));
  base[6][0] = base[6][1] = base[6][2] = 9; // a plain 3-run (9 is just a marker kind)
  const one = G.resolve(base, G.makeRng(1));
  assert.equal(one.steps[0].points, 30);
  assert.ok(G.findMatches(one.board).size === 0);
  let found = null;
  for (let seed = 1; seed < 400 && !found; seed++) {
    const r = G.resolve(base, G.makeRng(seed));
    if (r.steps.length >= 2) found = r;
  }
  assert.ok(found, "some seed cascades");
  assert.equal(found.steps[1].mult, 2);
  assert.equal(found.steps[1].points, found.steps[1].cleared.length * 20);
  assert.equal(found.points, found.steps.reduce((s, x) => s + x.points, 0));
});

test("no dead board after many moves; invalid swap is free; determinism", () => {
  const run = (seed) => {
    const rng = G.makeRng(seed), e = G.createEngine({ rng });
    let guard = 0;
    while (!e.state.over && guard++ < 500) {
      assert.ok(G.hasMove(e.state.board));
      assert.equal(G.findMatches(e.state.board).size, 0);
      const bad = e.swap({ r: 0, c: 0 }, { r: 0, c: 2 });
      assert.equal(bad.valid, false);
      let done = false;
      for (let r = 0; r < G.SIZE && !done; r++) for (let c = 0; c + 1 < G.SIZE && !done; c++) {
        const before = e.state.moves;
        const x = e.swap({ r, c }, { r, c: c + 1 });
        if (x.valid) { done = true; assert.equal(e.state.moves, before - 1); }
      }
      if (!done) for (let r = 0; r + 1 < G.SIZE && !done; r++) for (let c = 0; c < G.SIZE && !done; c++) done = e.swap({ r, c }, { r: r + 1, c }).valid;
      assert.ok(done);
    }
    assert.equal(e.state.moves, 0);
    assert.ok(Number.isInteger(e.state.score) && e.state.score > 0);
    return [e.state.score, JSON.stringify(e.state.board)];
  };
  assert.deepEqual(run(11), run(11));
  for (let s = 1; s < 15; s++) run(s);
});

test("reshuffle yields playable, match-free board", () => {
  const dead = Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) => (r * 2 + c * 3) % 5));
  const b = G.reshuffle(dead, G.makeRng(2));
  assert.ok(G.hasMove(b));
  assert.equal(G.findMatches(b).size, 0);
});
