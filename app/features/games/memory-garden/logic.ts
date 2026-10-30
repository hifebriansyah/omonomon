// Bunga Kenangan: a calm match-3. No timer; a fixed number of moves. Pure engine; Game.tsx is the view.
// Board: board[row][col] = 0..KINDS-1 (null only while resolving). Score: 10 per petal, cascade steps multiply x1, x2, x3...

export const SIZE = 7;
export const KINDS = 5;
export const MOVES = 20;
export const PETAL_POINTS = 10;

export type Cell = number | null;
export type Board = Cell[][];
export interface Pos {
  r: number;
  c: number;
}
export type Rng = () => number;
export interface Step {
  cleared: number[][];
  mult: number;
  points: number;
  board: Board;
}
export interface SwapResult {
  valid: boolean;
  points: number;
  steps: Step[];
  reshuffled: boolean;
}
export interface EngineState {
  board: Board;
  moves: number;
  score: number;
  over: boolean;
}
export interface Engine {
  state: EngineState;
  swap: (a: Pos, b: Pos) => SwapResult;
}

export const makeRng =
  (seed = 1): Rng =>
  () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

const pick = (rng: Rng, n: number) => Math.floor(rng() * n) % n;
export const cloneBoard = (b: Board): Board => b.map((r) => r.slice());

// Cells (as "r,c" keys) that sit in a run of 3+ in a row or column.
export function findMatches(board: Board): Set<string> {
  const n = board.length,
    hit = new Set<string>();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = board[r][c];
      if (v == null) continue;
      if (c + 2 < n && board[r][c + 1] === v && board[r][c + 2] === v) [0, 1, 2].forEach((k) => hit.add(`${r},${c + k}`));
      if (r + 2 < n && board[r + 1][c] === v && board[r + 2][c] === v) [0, 1, 2].forEach((k) => hit.add(`${r + k},${c}`));
    }
  }
  return hit;
}

export const isAdjacent = (a: Pos, b: Pos) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

export function swapped(board: Board, a: Pos, b: Pos): Board {
  const nb = cloneBoard(board);
  [nb[a.r][a.c], nb[b.r][b.c]] = [nb[b.r][b.c], nb[a.r][a.c]];
  return nb;
}

// A swap is valid if the cells are neighbours and the swapped board has a match.
export const isValidSwap = (board: Board, a: Pos, b: Pos) => isAdjacent(a, b) && findMatches(swapped(board, a, b)).size > 0;

export function hasMove(board: Board): boolean {
  const n = board.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c + 1 < n && isValidSwap(board, { r, c }, { r, c: c + 1 })) return true;
      if (r + 1 < n && isValidSwap(board, { r, c }, { r: r + 1, c })) return true;
    }
  }
  return false;
}

// Drop petals down within each column and fill the gaps from the top with new ones.
export function gravity(board: Board, rng: Rng): Board {
  const n = board.length,
    nb = cloneBoard(board);
  for (let c = 0; c < n; c++) {
    const keep: number[] = [];
    for (let r = n - 1; r >= 0; r--) if (nb[r][c] != null) keep.push(nb[r][c] as number);
    for (let r = n - 1, i = 0; r >= 0; r--, i++) nb[r][c] = i < keep.length ? keep[i] : pick(rng, KINDS);
  }
  return nb;
}

// A fresh board with no matches and at least one move.
export function createBoard(rng: Rng, size = SIZE): Board {
  for (;;) {
    const b: Board = Array.from({ length: size }, () => Array.from({ length: size }, () => pick(rng, KINDS)));
    for (let guard = 0; guard < 200 && findMatches(b).size; guard++) {
      for (const k of findMatches(b)) {
        const [r, c] = k.split(",").map(Number);
        b[r][c] = pick(rng, KINDS);
      }
    }
    if (!findMatches(b).size && hasMove(b)) return b;
  }
}

// Clears matches, drops, refills, repeats. Returns the final board, the points and each cascade step.
export function resolve(board: Board, rng: Rng): { board: Board; points: number; steps: Step[] } {
  let b = cloneBoard(board),
    total = 0,
    mult = 1;
  const steps: Step[] = [];
  for (let m = findMatches(b); m.size; m = findMatches(b)) {
    const cleared = [...m].map((k) => k.split(",").map(Number));
    const points = cleared.length * PETAL_POINTS * mult;
    cleared.forEach(([r, c]) => {
      b[r][c] = null;
    });
    b = gravity(b, rng);
    total += points;
    steps.push({ cleared, mult, points, board: cloneBoard(b) });
    mult += 1;
  }
  return { board: b, points: total, steps };
}

// Same petals, new places, until nothing matches and a move exists.
export function reshuffle(board: Board, rng: Rng): Board {
  const flat = board.flat(),
    n = board.length;
  for (let tries = 0; tries < 50; tries++) {
    for (let i = flat.length - 1; i > 0; i--) {
      const j = pick(rng, i + 1);
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    const b = Array.from({ length: n }, (_, r) => flat.slice(r * n, r * n + n));
    if (!findMatches(b).size && hasMove(b)) return b;
  }
  return createBoard(rng, n);
}

export function createEngine({ rng = Math.random, size = SIZE, moves = MOVES }: { rng?: Rng; size?: number; moves?: number } = {}): Engine {
  const s: EngineState = { board: createBoard(rng, size), moves, score: 0, over: false };
  return {
    state: s,
    // Returns { valid, points, steps, reshuffled }. An invalid swap costs nothing.
    swap(a, b) {
      if (s.over || !isValidSwap(s.board, a, b)) return { valid: false, points: 0, steps: [], reshuffled: false };
      const res = resolve(swapped(s.board, a, b), rng);
      s.board = res.board;
      s.score += res.points;
      s.moves -= 1;
      let reshuffled = false;
      if (s.moves > 0 && !hasMove(s.board)) {
        s.board = reshuffle(s.board, rng);
        reshuffled = true;
      }
      if (s.moves <= 0) s.over = true;
      return { valid: true, points: res.points, steps: res.steps, reshuffled };
    },
  };
}
