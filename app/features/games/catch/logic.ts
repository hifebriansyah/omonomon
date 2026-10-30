// Hair Catch: slide left and right to catch falling secrets with the ghost's hair, and dodge the dark ones.
// A secret is worth 10 points (a streak of 5 or more adds 5 each). A dark one costs a life; three lives.
// The rules only: no canvas, no timers. Game.tsx draws it (480x270 logical pixels, like Hop Hop) and calls update(dt).

export const W = 480;
export const H = 270;
export const GROUND = H - 8;
export const HERO_H = 82;
const LIVES = 3;
const KEY_SPEED = 300; // px/s with the arrow keys

export interface Item {
  x: number;
  y: number;
  vy: number;
  dark: boolean;
  spin: number;
}
export interface Pop {
  x: number;
  y: number;
  text: string;
  t: number;
  dark?: boolean;
}
export interface CatchState {
  state: "ready" | "running" | "over";
  time: number;
  x: number;
  targetX: number;
  vx: number;
  items: Item[];
  spawnIn: number;
  score: number;
  lives: number;
  streak: number;
  flash: number;
  pop: Pop[];
}

export const freshCatch = (): CatchState => ({ state: "ready", time: 0, x: W / 2, targetX: W / 2, vx: 0, items: [], spawnIn: 0.7, score: 0, lives: LIVES, streak: 0, flash: 0, pop: [] });

// Where the hair can catch: as wide as the picture (56px at least), the top 30px of it.
export function reach(heroW: number) {
  const catchW = Math.max(heroW * 0.95, 56);
  const catchTop = GROUND - HERO_H + 2; // the hair: the top of the picture
  return { catchW, catchTop, catchBottom: catchTop + 30 };
}

export const clampX = (x: number, catchW: number) => Math.max(catchW / 2, Math.min(W - catchW / 2, x));

export function start(s: CatchState) {
  if (s.state === "ready") s.state = "running";
}

// Move the game forward by dt seconds. `keys` are the arrow keys held down. Returns true when the last life was just lost.
export function update(s: CatchState, dt: number, heroW: number, keys: { left: boolean; right: boolean }, rng: () => number = Math.random): boolean {
  if (s.state !== "running") return false;
  const { catchW, catchTop, catchBottom } = reach(heroW);
  s.time += dt;
  s.flash = Math.max(0, s.flash - dt);
  if (keys.left) s.targetX = clampX(s.targetX - KEY_SPEED * dt, catchW);
  if (keys.right) s.targetX = clampX(s.targetX + KEY_SPEED * dt, catchW);
  const before = s.x;
  s.x += (s.targetX - s.x) * Math.min(1, 16 * dt);
  s.vx = (s.x - before) / (dt || 1);

  // it gets faster and darker the longer you last
  const fall = Math.min(250, 95 + s.time * 3.2);
  const darkShare = Math.min(0.45, 0.18 + s.time * 0.005);
  s.spawnIn -= dt;
  if (s.spawnIn <= 0) {
    s.items.push({ x: 18 + rng() * (W - 36), y: -14, vy: fall * (0.9 + rng() * 0.2), dark: rng() < darkShare, spin: rng() * 6 });
    s.spawnIn = Math.max(0.38, 0.85 - s.time * 0.008) * (0.75 + rng() * 0.5);
  }
  for (const it of s.items) {
    it.y += it.vy * dt;
    it.spin += dt * 3;
  }

  const left = s.x - catchW / 2;
  const right = s.x + catchW / 2;
  const keep: Item[] = [];
  for (const it of s.items) {
    const inReach = it.y + 12 >= catchTop && it.y - 12 <= catchBottom && it.x >= left - 6 && it.x <= right + 6;
    if (inReach) {
      if (it.dark) {
        s.lives -= 1;
        s.streak = 0;
        s.flash = 0.35;
        s.pop.push({ x: it.x, y: it.y, text: "-1", t: 0.8, dark: true });
        if (s.lives <= 0) {
          s.state = "over";
          return true;
        }
      } else {
        s.streak += 1;
        const gain = s.streak >= 5 ? 15 : 10;
        s.score += gain;
        s.pop.push({ x: it.x, y: it.y, text: `+${gain}`, t: 0.8 });
      }
    } else if (it.y - 14 > H) {
      if (!it.dark) s.streak = 0; // a secret that got away breaks the streak
    } else {
      keep.push(it);
    }
  }
  s.items = keep;
  s.pop = s.pop.map((p) => ({ ...p, t: p.t - dt, y: p.y - 30 * dt })).filter((p) => p.t > 0);
  return false;
}
