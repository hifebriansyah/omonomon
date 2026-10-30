// Obat Malam (Night Meds): pills fall; send each to its patient's tray (colour AND shape) before it reaches the floor.
// Right tray +10 (+15 once the streak is 5+), wrong tray or a missed pill costs one of 3 lives. It speeds up.
// createEngine holds the rules and knows nothing about the page; Game.tsx draws it.

export const LIVES = 3;
const ZONE = 0.3; // a pill can be sorted once it has fallen this far (0..1)
export const TRAYS = 3;

export interface Pill {
  kind: number;
  p: number; // 0 at the top, 1 on the floor
  fall: number; // seconds it takes to fall
}
export interface EngineState {
  t: number;
  score: number;
  lives: number;
  streak: number;
  best: number;
  sorted: number;
  over: boolean;
  pill: Pill | null;
  nextAt: number;
}
export type EngineEvent =
  | { type: "spawn"; kind: number }
  | { type: "miss"; kind: number }
  | { type: "over" }
  | { type: "idle" }
  | { type: "ok"; i: number; gain: number; streak: number }
  | { type: "wrong"; i: number; kind: number };
export interface Engine {
  tick: (dt: number) => EngineEvent[];
  choose: (i: number) => EngineEvent[];
  state: () => EngineState;
}

export function createEngine({ rng = Math.random, lives = LIVES }: { rng?: () => number; lives?: number } = {}): Engine {
  const st: EngineState = { t: 0, score: 0, lives, streak: 0, best: 0, sorted: 0, over: false, pill: null, nextAt: 0.6 };
  const fallAt = (t: number) => Math.max(1.1, 3.4 - t * 0.025); // seconds a pill takes to fall
  const gapAt = (t: number) => Math.max(0.25, 0.7 - t * 0.006);

  const lose = (events: EngineEvent[]) => {
    st.lives -= 1;
    st.streak = 0;
    if (st.lives <= 0) {
      st.over = true;
      events.push({ type: "over" });
    }
  };

  // Move time forward by dt seconds. Events: {type: "spawn", kind} | {type: "miss"} | {type: "over"}
  function tick(dt: number): EngineEvent[] {
    const events: EngineEvent[] = [];
    if (st.over) return events;
    st.t += dt;
    const p = st.pill;
    if (p) {
      p.p += dt / p.fall;
      if (p.p >= 1) {
        st.pill = null;
        st.nextAt = st.t + gapAt(st.t);
        events.push({ type: "miss", kind: p.kind });
        lose(events);
      }
    } else if (st.t >= st.nextAt) {
      st.pill = { kind: Math.floor(rng() * TRAYS), p: 0, fall: fallAt(st.t) };
      events.push({ type: "spawn", kind: st.pill.kind });
    }
    return events;
  }

  // Send the current pill to tray i. Before the pill reaches the drop zone nothing happens.
  function choose(i: number): EngineEvent[] {
    const p = st.pill;
    if (st.over || !p || p.p < ZONE || !(i >= 0 && i < TRAYS)) return [{ type: "idle" }];
    const events: EngineEvent[] = [];
    st.pill = null;
    st.nextAt = st.t + gapAt(st.t);
    if (i === p.kind) {
      st.streak += 1;
      st.best = Math.max(st.best, st.streak);
      st.sorted += 1;
      const gain = st.streak >= 5 ? 15 : 10;
      st.score += gain;
      events.push({ type: "ok", i, gain, streak: st.streak });
    } else {
      events.push({ type: "wrong", i, kind: p.kind });
      lose(events);
    }
    return events;
  }

  return { tick, choose, state: () => st };
}
