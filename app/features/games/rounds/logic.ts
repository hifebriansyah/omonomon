// Night Rounds (rounds): pure state and rules. Rooms light up on a night shift; tap each one before its timer runs out.
export const ROOMS = 6;
export const LIVES = 3;
export const TICK_MS = 50;

export interface RoomSlot {
  lit: boolean;
  deadline: number;
  window: number;
}

export interface RoundsState {
  t: number;
  score: number;
  lives: number;
  over: boolean;
  nextAt: number;
  rooms: RoomSlot[];
}

export type RoundsEvent =
  | { type: "lit"; i: number; window: number }
  | { type: "miss"; i: number }
  | { type: "over" }
  | { type: "idle"; i: number }
  | { type: "ok"; i: number; gain: number };

export interface RoundsEngine {
  tick: (dt: number) => RoundsEvent[];
  tap: (i: number) => RoundsEvent[];
  state: () => RoundsState;
}

export function createEngine({ rooms = ROOMS, rng = Math.random, lives = LIVES }: { rooms?: number; rng?: () => number; lives?: number } = {}): RoundsEngine {
  const st: RoundsState = {
    t: 0,
    score: 0,
    lives,
    over: false,
    nextAt: 0.8,
    rooms: Array.from({ length: rooms }, () => ({ lit: false, deadline: 0, window: 0 })),
  };
  const windowAt = (t: number) => Math.max(1.2, 3.0 - t * 0.03);
  const maxLitAt = (t: number) => (t < 20 ? 1 : t < 45 ? 2 : 3);
  const gapAt = (t: number) => Math.max(0.45, 1.3 - t * 0.012);

  function tick(dt: number): RoundsEvent[] {
    const events: RoundsEvent[] = [];
    if (st.over) return events;
    st.t += dt;
    st.rooms.forEach((r, i) => {
      if (st.over || !r.lit || st.t < r.deadline) return;
      r.lit = false;
      st.lives -= 1;
      events.push({ type: "miss", i });
      if (st.lives <= 0) {
        st.over = true;
        events.push({ type: "over" });
      }
    });
    if (st.over) return events;
    const litCount = st.rooms.filter((r) => r.lit).length;
    if (st.t >= st.nextAt && litCount < maxLitAt(st.t)) {
      const free = st.rooms.map((r, i) => (r.lit ? -1 : i)).filter((i) => i >= 0);
      const i = free[Math.floor(rng() * free.length)];
      const window = windowAt(st.t);
      st.rooms[i] = { lit: true, deadline: st.t + window, window };
      events.push({ type: "lit", i, window });
      st.nextAt = st.t + gapAt(st.t) * (0.7 + rng() * 0.6);
    }
    return events;
  }

  function tap(i: number): RoundsEvent[] {
    const r = st.rooms[i];
    if (st.over || !r) return [];
    if (!r.lit) return [{ type: "idle", i }];
    const left = (r.deadline - st.t) / r.window;
    r.lit = false;
    const gain = 10 + (left > 0.5 ? 5 : 0);
    st.score += gain;
    return [{ type: "ok", i, gain }];
  }

  return { tick, tap, state: () => st };
}
