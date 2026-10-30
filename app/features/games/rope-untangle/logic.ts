// Tali Lepas: untangle the ropes. Drag the knots until no two ropes cross. One run lasts 90 seconds.
// A solved level scores 20 + 2 per second left on its 30 s clock; "skip" costs 5 points (never below 0).
// The rules (createRun, makeLevel, ...) know nothing about the page, so tests/legacy/rope-untangle.test.mjs can run them alone.

export const RUN_SECONDS = 90;
export const LEVEL_SECONDS = 30;
export const SKIP_COST = 5;

export interface Pt {
  x: number;
  y: number;
}
export type Edge = [number, number];
export interface Level {
  n: number;
  edges: Edge[];
  solution: Pt[];
  pts: Pt[];
}
export interface RunState {
  t: number;
  levelT: number;
  level: number;
  score: number;
  solved: number;
  over: boolean;
  bad: Set<number>;
  g: Level;
}
export type Rng = () => number;

export const knotsFor = (level: number) => Math.min(14, 5 + level + Math.floor(level / 2)); // 5,6,8,9,11,12,14...
export const solveScore = (secLeft: number) => 20 + 2 * Math.max(0, Math.min(LEVEL_SECONDS, Math.floor(secLeft)));

const ccw = (a: Pt, b: Pt, c: Pt) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);

// Do segments p1p2 and p3p4 cross? Ropes that share a knot never count.
export function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = ccw(p3, p4, p1),
    d2 = ccw(p3, p4, p2),
    d3 = ccw(p1, p2, p3),
    d4 = ccw(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Indices of the edges (pairs [a, b] of knot indexes) that cross at least one other edge.
export function crossingEdges(pts: Pt[], edges: Edge[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i],
        [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segmentsCross(pts[a], pts[b], pts[c], pts[d])) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return bad;
}
export const countCrossings = (pts: Pt[], edges: Edge[]) => crossingEdges(pts, edges).size;

// A level: `solution` is a layout with no crossings; `pts` is the same knots scrambled so that ropes cross.
export function makeLevel(n: number, rng: Rng = Math.random): Level {
  const solution: Pt[] = Array.from({ length: n }, () => ({ x: 0.06 + rng() * 0.88, y: 0.06 + rng() * 0.88 }));
  const pairs: { a: number; b: number; w: number }[] = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      pairs.push({ a, b, w: Math.hypot(solution[a].x - solution[b].x, solution[a].y - solution[b].y) * (0.6 + rng() * 0.8) });
    }
  pairs.sort((p, q) => p.w - q.w);
  const target = Math.min(3 * n - 6, Math.round(n * 1.5));
  const edges: Edge[] = [];
  const deg: number[] = new Array(n).fill(0);
  for (const { a, b } of pairs) {
    if (edges.length >= target) break;
    if (deg[a] >= 4 || deg[b] >= 4) continue;
    const ok = edges.every(([c, d]) => c === a || c === b || d === a || d === b || !segmentsCross(solution[a], solution[b], solution[c], solution[d]));
    if (ok) {
      edges.push([a, b]);
      deg[a]++;
      deg[b]++;
    }
  }
  // Scramble: shuffle the layout until enough ropes cross (a handful of tries; keep the messiest).
  const want = Math.max(2, Math.floor(edges.length / 3));
  let best: Pt[] | null = null,
    bestC = -1;
  for (let tries = 0; tries < 60; tries++) {
    const pts = solution.map(() => ({ x: 0.06 + rng() * 0.88, y: 0.06 + rng() * 0.88 }));
    const c = countCrossings(pts, edges);
    if (c > bestC) {
      best = pts;
      bestC = c;
    }
    if (c >= want) break;
  }
  return { n, edges, solution, pts: best as Pt[] };
}

export interface Run {
  state: () => RunState;
  tick: (dt: number) => void;
  move: (i: number, x: number, y: number) => "solved" | null;
  finish: () => number;
  skip: () => number;
}

// One run. tick(dt) moves the clock; move(i, x, y) drags a knot (0..1); skip() gives up the level.
export function createRun({ rng = Math.random }: { rng?: Rng } = {}): Run {
  const st: RunState = { t: 0, levelT: 0, level: 0, score: 0, solved: 0, over: false, bad: new Set<number>(), g: null as unknown as Level };
  const load = () => {
    st.g = makeLevel(knotsFor(st.level), rng);
    st.levelT = 0;
    st.bad = crossingEdges(st.g.pts, st.g.edges);
  };
  load();
  const next = () => {
    st.level += 1;
    load();
  };
  return {
    state: () => st,
    tick(dt) {
      if (st.over) return;
      st.t += dt;
      st.levelT += dt;
      if (st.t >= RUN_SECONDS) {
        st.t = RUN_SECONDS;
        st.over = true;
      }
    },
    move(i, x, y) {
      if (st.over || !st.g.pts[i]) return null;
      st.g.pts[i] = { x: Math.min(0.97, Math.max(0.03, x)), y: Math.min(0.97, Math.max(0.03, y)) };
      st.bad = crossingEdges(st.g.pts, st.g.edges);
      return st.bad.size === 0 ? "solved" : null;
    },
    // Call after the drag ends (not during it) so a half-way drop does not end the level by accident.
    finish() {
      if (st.over || st.bad.size) return 0;
      const gain = solveScore(LEVEL_SECONDS - st.levelT);
      st.score += gain;
      st.solved += 1;
      next();
      return gain;
    },
    skip() {
      if (st.over) return 0;
      const cost = Math.min(SKIP_COST, st.score);
      st.score -= cost;
      next();
      return cost;
    },
  };
}
