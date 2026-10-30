// Hop Hop: a one-button endless runner. The ghost hops over tombstones; the score is the distance.
// The rules only: no canvas, no timers. Game.tsx draws it (480x270 logical pixels, scaled to the screen) and calls update(dt).

export const W = 480;
export const H = 270;
export const GROUND = 212;
export const HERO_X = 70;
export const HERO_H = 66;
const GRAVITY = 1500; // px/s^2
const JUMP_SPEED = 520; // px/s upward: about 90px high, 0.7s in the air
const START_SPEED = 200; // px/s
const MAX_SPEED = 420;
const SPEEDUP = 8; // px/s gained every second

export interface Obstacle {
  x: number;
  w: number;
  h: number;
}
export interface RunnerState {
  state: "ready" | "running" | "over";
  time: number;
  dist: number;
  speed: number;
  y: number;
  vy: number;
  obstacles: Obstacle[];
  spawnIn: number;
  score: number;
}

export const freshRunner = (): RunnerState => ({ state: "ready", time: 0, dist: 0, speed: START_SPEED, y: 0, vy: 0, obstacles: [], spawnIn: 260, score: 0 });

// The first tap starts the run; after that a tap hops, but only from the ground.
export function jump(s: RunnerState) {
  if (s.state === "ready") {
    s.state = "running";
    return;
  }
  if (s.state === "running" && s.y === 0) s.vy = JUMP_SPEED;
}

// Move the run forward by dt seconds. `heroW` is the drawn width of the ghost. Returns true when she just hit a tombstone.
export function update(s: RunnerState, dt: number, heroW: number, rng: () => number = Math.random): boolean {
  if (s.state !== "running") return false;
  s.time += dt;
  s.speed = Math.min(MAX_SPEED, START_SPEED + s.time * SPEEDUP);
  s.dist += s.speed * dt;
  s.score = Math.floor(s.dist / 10);

  s.y = Math.max(0, s.y + s.vy * dt);
  s.vy = s.y === 0 ? 0 : s.vy - GRAVITY * dt;

  s.spawnIn -= s.speed * dt;
  if (s.spawnIn <= 0) {
    const w = 22 + rng() * 14;
    const h = 30 + rng() * 26;
    s.obstacles.push({ x: W + 20, w, h });
    s.spawnIn = (0.9 + rng() * 0.9) * s.speed + 90; // always a jumpable gap
  }
  for (const o of s.obstacles) o.x -= s.speed * dt;
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);

  // collision: the ghost's box is a little smaller than the picture
  const left = HERO_X + 12;
  const right = HERO_X + heroW - 12;
  const bottom = GROUND - s.y - 4;
  for (const o of s.obstacles) {
    if (right > o.x + 4 && left < o.x + o.w - 4 && bottom > GROUND - o.h + 4) {
      s.state = "over";
      return true;
    }
  }
  return false;
}
