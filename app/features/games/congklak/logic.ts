// Congklak: traditional Indonesian mancala, 2 x 7 holes + 2 stores (houses), 7 seeds per hole (98 seeds in all).
// Pure rules and AI (tests/legacy/congklak.test.mjs is the spec).
export const MAX_CONT = 60;
export const HOLES = 7;
export const TOTAL = 98;
export type Difficulty = "easy" | "medium" | "mediumhard" | "hard";
export const LEVELS: Record<string, Difficulty> = { "3": "easy", "4": "medium", "1": "mediumhard", "2": "hard" };

export interface CongklakState {
  b: number[];
  turn: 0 | 1;
  over: boolean;
}

export interface StepRecord {
  kind: "pick" | "drop" | "cap";
  i: number;
  b: number[];
}

export interface MoveResult {
  state: CongklakState;
  path: StepRecord[];
  extra: boolean;
  captured: number;
}

const storeOf = (side: number) => side * 8 + 7;
const sideOf = (i: number): 0 | 1 => (i >= 8 ? 1 : 0);

export function initialState(): CongklakState {
  const b = new Array<number>(16).fill(HOLES);
  b[7] = 0;
  b[15] = 0;
  return { b, turn: 0, over: false };
}

export function legalMoves(s: CongklakState): number[] {
  if (s.over) return [];
  const out: number[] = [];
  for (let i = s.turn * 8; i < s.turn * 8 + HOLES; i++) if (s.b[i] > 0) out.push(i);
  return out;
}

function finish(s: CongklakState) {
  for (let side = 0; side < 2; side++) {
    for (let i = side * 8; i < side * 8 + HOLES; i++) {
      s.b[storeOf(side)] += s.b[i];
      s.b[i] = 0;
    }
  }
  s.over = true;
}

export function applyMove(state: CongklakState, from: number, record = true): MoveResult {
  const b = state.b.slice();
  const side = state.turn;
  if (state.over || sideOf(from) !== side || from % 8 >= HOLES || b[from] <= 0) throw new Error("illegal move");
  const store = storeOf(side);
  const skip = storeOf(1 - side);
  const path: StepRecord[] = [];
  const log = (kind: StepRecord["kind"], i: number) => {
    if (record) path.push({ kind, i, b: b.slice() });
  };
  let hand = b[from];
  let i = from;
  let cont = 0;
  let extra = false;
  let captured = 0;
  b[from] = 0;
  log("pick", from);
  for (;;) {
    while (hand > 0) {
      i = (i + 1) % 16;
      if (i === skip) continue;
      b[i]++;
      hand--;
      log("drop", i);
    }
    if (i === store) {
      extra = true;
      break;
    }
    if (b[i] > 1) {
      if (++cont > MAX_CONT) break;
      hand = b[i];
      b[i] = 0;
      log("pick", i);
      continue;
    }
    if (sideOf(i) === side && b[14 - i] > 0) {
      captured = b[14 - i] + 1;
      b[store] += captured;
      b[14 - i] = 0;
      b[i] = 0;
      log("cap", i);
    }
    break;
  }
  const next: CongklakState = { b, turn: extra ? side : ((1 - side) as 0 | 1), over: false };
  if (legalMoves(next).length === 0) finish(next);
  return { state: next, path, extra, captured };
}

export function winnerOf(s: CongklakState): 0 | 1 | -1 {
  return s.b[7] > s.b[15] ? 0 : s.b[7] < s.b[15] ? 1 : -1;
}

export function scoreOf(s: CongklakState, level?: Difficulty): number {
  const win = winnerOf(s) === 0;
  return s.b[7] + (win ? 30 + (level === "hard" ? 10 : 0) : 0);
}

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickOne = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length) % arr.length];
const diffFor = (s: CongklakState, side: number) => s.b[storeOf(side)] - s.b[storeOf(1 - side)];

function bestBy(moves: number[], rng: () => number, score: (m: number) => number): number {
  let best = -Infinity;
  let pool: number[] = [];
  for (const m of moves) {
    const v = score(m);
    if (v > best) {
      best = v;
      pool = [m];
    } else if (v === best) pool.push(m);
  }
  return pickOne(pool, rng);
}

function greedy(s: CongklakState, rng: () => number, extraBonus: number): number {
  const me = s.turn;
  const base = diffFor(s, me);
  return bestBy(legalMoves(s), rng, (m) => {
    const r = applyMove(s, m, false);
    return diffFor(r.state, me) - base + (r.extra && !r.state.over ? extraBonus : 0);
  });
}

function evalLeaf(s: CongklakState, me: number): number {
  let v = diffFor(s, me);
  if (!s.over) {
    let mine = 0;
    let theirs = 0;
    for (let k = 0; k < HOLES; k++) {
      mine += s.b[me * 8 + k];
      theirs += s.b[(1 - me) * 8 + k];
    }
    v += 0.15 * (mine - theirs);
  }
  return v;
}

function search(s: CongklakState, depth: number, alpha: number, beta: number, me: number): number {
  if (s.over || depth === 0) return evalLeaf(s, me);
  const max = s.turn === me;
  let best = max ? -Infinity : Infinity;
  for (const m of legalMoves(s)) {
    const v = search(applyMove(s, m, false).state, depth - 1, alpha, beta, me);
    if (max) {
      if (v > best) best = v;
      if (v > alpha) alpha = v;
    } else {
      if (v < best) best = v;
      if (v < beta) beta = v;
    }
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(s: CongklakState, level: Difficulty, rng: () => number = Math.random): number {
  const moves = legalMoves(s);
  if (moves.length === 1) return moves[0];
  if (level === "easy") return rng() < 0.4 ? greedy(s, rng, 0) : pickOne(moves, rng);
  if (level === "medium") return greedy(s, rng, 0);
  if (level === "mediumhard") return greedy(s, rng, 3);
  const me = s.turn;
  return bestBy(moves, rng, (m) => search(applyMove(s, m, false).state, 3, -Infinity, Infinity, me) + rng() * 1e-6);
}
