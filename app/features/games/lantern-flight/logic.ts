// Lentera Terbang (Lantern Flight): pure rules (tests/legacy/lantern-flight.test.mjs is the spec).
export const FINISH = 110;
export const RISE = 1.5;
export const XMAX = 2.8;
export const ROW = 4;
export const AHEAD = 14;
export const LANTERN_R = 0.35;
export const FLAMES = 3;
const STEER = 1.7;

export type SkyItemKind = "wish" | "branch" | "kite";

export interface SkyItem {
  kind: SkyItemKind;
  x: number;
  y: number;
  r: number;
  vx: number;
}

export interface LanternState {
  x: number;
  vx: number;
  y: number;
  flames: number;
  score: number;
  wishes: number;
  time: number;
  invuln: number;
  done: "out" | "moon" | null;
  items: SkyItem[];
  nextRow: number;
}

export type LanternEvent = "wish" | "hit" | "moon" | "out";

export interface LanternEngine {
  state: () => LanternState;
  step: (dt: number, hold: boolean) => LanternEvent[];
}

export function spawnRow(rng: () => number, y: number): SkyItem[] {
  const out: SkyItem[] = [];
  const r = rng();
  if (r < 0.42) {
    const edge = rng() < 0.5 ? -1 : 1;
    out.push({ kind: "branch", x: edge * (2.1 + rng() * 0.7), y, r: 0.75, vx: 0 });
  } else if (r < 0.62) {
    out.push({ kind: "kite", x: (rng() * 2 - 1) * 2.3, y, r: 0.42, vx: (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.4) });
  }
  const n = rng() < 0.7 ? 1 : rng() < 0.3 ? 2 : 0;
  for (let i = 0; i < n; i++) out.push({ kind: "wish", x: (rng() * 2 - 1) * XMAX * 0.9, y: y + 1 + i * 1.3 + rng(), r: 0.32, vx: 0 });
  return out;
}

export const hit = (a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }): boolean =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.r + b.r) ** 2;

export const scoreOf = (wishes: number, reachedMoon: boolean): number => wishes * 10 + (reachedMoon ? 50 : 0);

export function createEngine({ rng = Math.random }: { rng?: () => number } = {}): LanternEngine {
  const s: LanternState = {
    x: 0,
    vx: 0,
    y: 0,
    flames: FLAMES,
    score: 0,
    wishes: 0,
    time: 0,
    invuln: 0,
    done: null,
    items: [],
    nextRow: 5,
  };
  const me = { x: 0, y: 0, r: LANTERN_R };
  function step(dt: number, hold: boolean): LanternEvent[] {
    const ev: LanternEvent[] = [];
    if (s.done) return ev;
    s.time += dt;
    s.vx += ((hold ? STEER : -STEER) - s.vx) * Math.min(1, dt * 3);
    s.x += s.vx * dt;
    if (Math.abs(s.x) > XMAX) {
      s.x = Math.sign(s.x) * XMAX;
      s.vx = 0;
    }
    s.y += RISE * dt;
    s.invuln = Math.max(0, s.invuln - dt);
    while (s.nextRow <= s.y + AHEAD && s.nextRow < FINISH - 4) {
      s.items.push(...spawnRow(rng, s.nextRow));
      s.nextRow += ROW;
    }
    me.x = s.x;
    me.y = s.y;
    let k = 0;
    for (const it of s.items) {
      if (it.vx) {
        it.x += it.vx * dt;
        if (Math.abs(it.x) > XMAX) it.vx = -it.vx;
      }
      let keep = it.y > s.y - 6;
      if (keep && hit(me, it)) {
        if (it.kind === "wish") {
          s.wishes++;
          s.score = scoreOf(s.wishes, false);
          ev.push("wish");
          keep = false;
        } else if (s.invuln <= 0) {
          s.flames--;
          s.invuln = 1.6;
          ev.push("hit");
          keep = false;
        }
      }
      if (keep) s.items[k++] = it;
    }
    s.items.length = k;
    if (s.flames <= 0) {
      s.done = "out";
      ev.push("out");
    } else if (s.y >= FINISH) {
      s.done = "moon";
      s.score = scoreOf(s.wishes, true);
      ev.push("moon");
    }
    return ev;
  }
  return { state: () => s, step };
}
