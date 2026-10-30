import test from "node:test";
import assert from "node:assert/strict";
import { initialState, legalMoves, applyMove, chooseMove, scoreOf, winnerOf, makeRng, TOTAL } from "../assets/scripts/games/congklak.js";

const sum = (s) => s.b.reduce((a, c) => a + c, 0);
const mk = (b, turn = 0) => ({ b, turn, over: false });
const empty = () => new Array(16).fill(0);

test("initial board", () => {
  const s = initialState();
  assert.equal(sum(s), TOTAL);
  assert.deepEqual(legalMoves(s), [0, 1, 2, 3, 4, 5, 6]);
});

test("hand-checked sowing: hole 0 of 7 lands in hole 7 = store -> wait, 7 seeds end in store", () => {
  // hole 6 has 7: drops on 7,8..13; last on hole 13 (7 seeds -> 8) so it continues. Check first-step path.
  const r = applyMove(initialState(), 6);
  assert.deepEqual(r.path.slice(0, 8).map((p) => p.i), [6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(sum(r.state), TOTAL);
});

test("extra turn when last seed lands in own store", () => {
  const b = empty(); b[5] = 2; b[2] = 1; b[10] = 3;
  const r = applyMove(mk(b), 5);
  assert.equal(r.extra, true);
  assert.equal(r.state.turn, 0);
  assert.equal(r.state.b[7], 1 + 0);
  assert.equal(r.state.b[6], 1);
});

test("opponent store is skipped", () => {
  const b = empty(); b[8 + 6] = 3; b[0] = 1;
  const r = applyMove(mk(b, 1), 14);
  assert.equal(r.state.b[7], 0); // skipped player store: seeds go 15, 0, 1
  assert.equal(r.state.b[15] >= 1, true);
});

test("capture of facing hole", () => {
  const b = empty(); b[1] = 1; b[13] = 4; b[0] = 0; b[10] = 2;
  const r = applyMove(mk(b), 1); // lands in empty hole 2, facing 12 (empty) -> no capture
  assert.equal(r.captured, 0);
  const c = empty(); c[0] = 1; c[1] = 0; c[13] = 5; c[8] = 1;
  const r2 = applyMove(mk(c), 0); // lands in empty hole 1, facing 13 (5): capture 6
  assert.equal(r2.captured, 6);
  assert.equal(r2.state.b[7], 6);
  assert.equal(r2.state.b[13], 0);
  assert.equal(r2.state.turn, 1);
});

test("continuation sowing from non-empty hole", () => {
  const b = empty(); b[0] = 1; b[1] = 1; b[3] = 5; b[9] = 1;
  const r = applyMove(mk(b), 0); // lands on hole 1 (now 2), picks 2: drops 2,3 -> hole 3 (6) pick 6...
  assert.equal(sum(r.state), 8);
  assert.ok(r.path.filter((p) => p.kind === "pick").length >= 2);
});

test("game end sweeps seeds to their owners and scores", () => {
  const b = empty(); b[0] = 1; b[10] = 4; b[7] = 40; b[15] = 53;
  const r = applyMove(mk(b), 0); // lands in empty hole 1, facing 13 empty -> turn passes; opp to move with seeds
  assert.equal(r.state.over, false);
  const b2 = empty(); b2[6] = 1; b2[7] = 50; b2[15] = 40; b2[9] = 7;
  const e = applyMove(mk(b2), 6); // into store, extra, but own side empty: over; 7 go to opponent
  assert.equal(e.state.over, true);
  assert.equal(e.state.b[7], 51);
  assert.equal(e.state.b[15], 47);
  assert.equal(sum(e.state), 98);
  assert.equal(winnerOf(e.state), 0);
  assert.equal(scoreOf(e.state, "easy"), 51 + 30);
  assert.equal(scoreOf(e.state, "hard"), 51 + 40);
  const lost = { b: [0, 0, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0, 0, 0, 0, 68], turn: 0, over: true };
  assert.equal(scoreOf(lost, "hard"), 30);
});

test("AI always legal, deterministic with rng, full games terminate", () => {
  const levels = ["easy", "medium", "mediumhard", "hard"];
  for (const lv of levels) {
    for (let seed = 1; seed <= 3; seed++) {
      const rng = makeRng(seed);
      let s = initialState(), n = 0;
      while (!s.over) {
        const lvl = s.turn === 0 ? "medium" : lv;
        const t0 = Date.now();
        const m = chooseMove(s, lvl, rng);
        if (lvl === "hard") assert.ok(Date.now() - t0 < 500);
        assert.ok(legalMoves(s).includes(m));
        s = applyMove(s, m).state;
        assert.equal(sum(s), TOTAL);
        assert.ok(++n < 2000, "game did not terminate");
      }
    }
  }
  const a = chooseMove(initialState(), "easy", makeRng(7)), b = chooseMove(initialState(), "easy", makeRng(7));
  assert.equal(a, b);
});
