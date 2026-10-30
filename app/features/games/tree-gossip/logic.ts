// Gosip Pohon: secrets peek out of a tree; tap them before they hide. Crows and bats cost a life (3 lives).
// createEngine holds the rules and knows nothing about the page. Game.tsx draws the branches.

export const SPOTS = 9;
export const LIVES = 3;
export const TICK_MS = 50;

export type Kind = "secret" | "crow" | "bat";
export interface Spot {
  kind: Kind | null;
  deadline: number;
  window: number;
}
export interface EngineState {
  t: number;
  score: number;
  lives: number;
  streak: number;
  over: boolean;
  nextAt: number;
  spots: Spot[];
}
export type EngineEvent =
  | { type: "show"; i: number; kind: Kind; window: number }
  | { type: "hide"; i: number; kind: Kind }
  | { type: "over" }
  | { type: "idle"; i: number }
  | { type: "ok"; i: number; gain: number; streak: number }
  | { type: "bad"; i: number; kind: Kind };
export interface Engine {
  tick: (dt: number) => EngineEvent[];
  tap: (i: number) => EngineEvent[];
  state: () => EngineState;
}

export function createEngine({ spots = SPOTS, rng = Math.random, lives = LIVES }: { spots?: number; rng?: () => number; lives?: number } = {}): Engine {
  const st: EngineState = {
    t: 0,
    score: 0,
    lives,
    streak: 0,
    over: false,
    nextAt: 0.6,
    spots: Array.from({ length: spots }, () => ({ kind: null, deadline: 0, window: 0 })),
  };
  const windowAt = (t: number) => Math.max(0.7, 1.9 - t * 0.02); // seconds a peeker stays out
  const maxUpAt = (t: number) => (t < 15 ? 1 : t < 35 ? 2 : t < 60 ? 3 : 4); // peekers at once
  const gapAt = (t: number) => Math.max(0.35, 1.0 - t * 0.01); // seconds between peekers
  const decoyAt = (t: number) => Math.min(0.35, 0.2 + t * 0.003); // chance a peeker is a decoy

  // Move time forward by dt seconds. Events: {type:"show",i,kind,window} | {type:"hide",i,kind} | {type:"over"}
  function tick(dt: number): EngineEvent[] {
    const events: EngineEvent[] = [];
    if (st.over) return events;
    st.t += dt;
    st.spots.forEach((s, i) => {
      if (!s.kind || st.t < s.deadline) return;
      const kind = s.kind;
      s.kind = null;
      if (kind === "secret") st.streak = 0;
      events.push({ type: "hide", i, kind });
    });
    const up = st.spots.filter((s) => s.kind).length;
    if (st.t >= st.nextAt && up < maxUpAt(st.t)) {
      const free = st.spots.map((s, i) => (s.kind ? -1 : i)).filter((i) => i >= 0);
      const i = free[Math.floor(rng() * free.length)];
      const kind: Kind = rng() < decoyAt(st.t) ? (rng() < 0.5 ? "crow" : "bat") : "secret";
      const window = windowAt(st.t);
      st.spots[i] = { kind, deadline: st.t + window, window };
      events.push({ type: "show", i, kind, window });
      st.nextAt = st.t + gapAt(st.t) * (0.7 + rng() * 0.6);
    }
    return events;
  }

  // Tap a spot. An empty spot costs nothing.
  function tap(i: number): EngineEvent[] {
    const s = st.spots[i];
    if (st.over || !s) return [];
    if (!s.kind) return [{ type: "idle", i }];
    const kind = s.kind;
    s.kind = null;
    if (kind === "secret") {
      st.streak += 1;
      const gain = st.streak >= 5 ? 15 : 10;
      st.score += gain;
      return [{ type: "ok", i, gain, streak: st.streak }];
    }
    st.streak = 0;
    st.lives -= 1;
    const events: EngineEvent[] = [{ type: "bad", i, kind }];
    if (st.lives <= 0) {
      st.over = true;
      events.push({ type: "over" });
    }
    return events;
  }

  return { tick, tap, state: () => st };
}
