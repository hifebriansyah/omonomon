// Hop Hop 3D (Lompat Kubur): pure rules (tests/legacy/hop-hop-3d.test.mjs is the spec).
export const LANES = [-1, 0, 1] as const;
export const LANE_W = 1.6;
export const SPEED0 = 8;
export const SPEED_MAX = 19;
export const ACCEL = 0.2;
export const SCORE_K = 1.25;
export const GRAV = 20;
export const HOP_V = 7;
export const SPAWN_AHEAD = 55;
export const PLAYER = { hw: 0.3, hd: 0.25, h: 0.95 };

export type ObstacleKind = "tomb" | "cross" | "branch";

export const KINDS: Record<ObstacleKind, { h0: number; h1: number; hw: number; hd: number }> = {
  tomb: { h0: 0, h1: 0.7, hw: 0.45, hd: 0.3 },
  cross: { h0: 0, h1: 0.8, hw: 0.3, hd: 0.2 },
  branch: { h0: 1.0, h1: 2.4, hw: 0.75, hd: 0.3 },
};

export interface HopObstacle {
  d: number;
  lane: number;
  kind: ObstacleKind;
}

export const scoreOf = (distance: number): number => Math.max(0, Math.floor(distance * SCORE_K));
export const speedAt = (t: number): number => Math.min(SPEED_MAX, SPEED0 + ACCEL * t);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function planRow(rng: () => number, speed = SPEED0): (ObstacleKind | null)[] {
  const diff = clamp((speed - SPEED0) / (SPEED_MAX - SPEED0), 0, 1);
  const row: (ObstacleKind | null)[] = [null, null, null];
  const free = Math.min(2, Math.floor(rng() * 3));
  const blocked = [0, 1, 2].filter((i) => i !== free);
  const n = rng() < 0.25 + 0.35 * diff ? 2 : 1;
  if (n === 1) blocked.splice(Math.min(1, Math.floor(rng() * 2)), 1);
  for (const i of blocked) {
    const r = rng();
    row[i] = r < 0.2 + 0.15 * diff ? "branch" : r < 0.65 ? "tomb" : "cross";
  }
  return row;
}

export const rowGap = (speed: number, rng: () => number): number => speed * (1.1 + rng() * 0.7);

export function spawnAhead(state: { next: number }, upto: number, speed: number, rng: () => number, out: HopObstacle[]): HopObstacle[] {
  while (state.next <= upto) {
    const row = planRow(rng, speed);
    for (let i = 0; i < 3; i++) if (row[i]) out.push({ d: state.next, lane: LANES[i], kind: row[i]! });
    state.next += rowGap(speed, rng);
  }
  return out;
}

export function collides(p: { x: number; y: number; d: number }, o: HopObstacle): boolean {
  const k = KINDS[o.kind];
  return (
    Math.abs(p.x - o.lane * LANE_W) < k.hw + PLAYER.hw &&
    Math.abs(p.d - o.d) < k.hd + PLAYER.hd &&
    p.y < k.h1 &&
    p.y + PLAYER.h > k.h0
  );
}

export interface Hop3DEngine {
  t: number;
  d: number;
  speed: number;
  lane: number;
  x: number;
  y: number;
  vy: number;
  over: boolean;
  score: number;
  obs: HopObstacle[];
  spawn: { next: number };
  moveLane: (dir: number) => void;
  hop: () => boolean;
  step: (dt: number) => Hop3DEngine;
}

export function createEngine({ rng = Math.random }: { rng?: () => number } = {}): Hop3DEngine {
  const e: Hop3DEngine = {
    t: 0,
    d: 0,
    speed: SPEED0,
    lane: 0,
    x: 0,
    y: 0,
    vy: 0,
    over: false,
    score: 0,
    obs: [],
    spawn: { next: 30 },
    moveLane: (dir: number) => {
      if (!e.over) e.lane = clamp(e.lane + dir, -1, 1);
    },
    hop: () => {
      if (e.over || e.y !== 0 || e.vy !== 0) return false;
      e.vy = HOP_V;
      return true;
    },
    step: (dt: number) => {
      let left = Math.min(dt, 0.1);
      while (left > 1e-9 && !e.over) {
        const s = Math.min(left, 1 / 60);
        sub(s);
        left -= s;
      }
      return e;
    },
  };

  function sub(dt: number) {
    e.t += dt;
    e.speed = speedAt(e.t);
    e.d += e.speed * dt;
    const dx = e.lane * LANE_W - e.x;
    e.x += clamp(dx, -14 * dt, 14 * dt);
    if (e.vy !== 0 || e.y > 0) {
      e.vy -= GRAV * dt;
      e.y += e.vy * dt;
      if (e.y <= 0) {
        e.y = 0;
        e.vy = 0;
      }
    }
    spawnAhead(e.spawn, e.d + SPAWN_AHEAD, e.speed, rng, e.obs);
    let n = 0;
    for (let i = 0; i < e.obs.length; i++) if (e.obs[i].d > e.d - 4) e.obs[n++] = e.obs[i];
    e.obs.length = n;
    for (let i = 0; i < n; i++)
      if (collides(e, e.obs[i])) {
        e.over = true;
        break;
      }
    e.score = scoreOf(e.d);
  }

  return e;
}
