// Rumah Hantu (Haunted House): pure rules (tests/legacy/haunted-house.test.mjs is the spec).
export const HALF = 5;
export const WALL_H = 3.2;
export const PLAYER_R = 0.3;
export const START = { x: 0, z: 4 };
export const DOOR = { x: 0, z: -4.3, r: 1.1 };
export const ROOM_CHARS = ["1", "2", "3", "4"] as const;
export const PER_ROOM = 25;
export const BONUS_FAST = 60;
export const BONUS_SLOW = 180;
export const BONUS_MAX = 50;
export const COUNTS = { items: 5, lanterns: 4, petals: 3, secrets: 3 };
export type RoomKind = "items" | "lanterns" | "petals" | "secrets";
export const KINDS: RoomKind[] = ["items", "lanterns", "petals", "secrets"];
export type LanternColor = "red" | "blue" | "gold" | "green";
export const LANTERN_COLORS: LanternColor[] = ["red", "blue", "gold", "green"];
export type FurnitureName = "wardrobe" | "shelf" | "trunk" | "mirror" | "table";
export const FURNITURE: Record<FurnitureName, { size: [number, number, number]; secret: boolean }> = {
  wardrobe: { size: [1.2, 2.2, 0.7], secret: true },
  shelf: { size: [1.6, 2.0, 0.5], secret: true },
  trunk: { size: [1.1, 0.7, 0.7], secret: true },
  mirror: { size: [0.9, 1.9, 0.2], secret: false },
  table: { size: [1.4, 0.9, 1.0], secret: false },
};

export interface Box2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const box = (minX: number, maxX: number, minZ: number, maxZ: number): Box2D => ({ minX, maxX, minZ, maxZ });
export const WALLS: Box2D[] = [box(-5.4, -5, -5.4, 5.4), box(5, 5.4, -5.4, 5.4), box(-5.4, 5.4, -5.4, -5), box(-5.4, 5.4, 5, 5.4)];
export const PROPS: Box2D[][] = [
  [box(-3.6, -2.2, 0, 1.4), box(2.2, 3.6, 1.8, 3.2)],
  [box(-0.8, 0.8, -0.6, 0.8)],
  [box(-2.5, -1.7, -1.2, -0.4), box(1.7, 2.5, 1.2, 2)],
  [],
];
export const GHOST_AT = [
  { x: -3.6, z: -3.4 },
  { x: 3.6, z: -3.4 },
  { x: -3.6, z: -3.4 },
  { x: 3.6, z: -3.4 },
];

export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pushOut(x: number, z: number, r: number, b: Box2D): { x: number; z: number } | null {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, z: cz + (dz / d) * r };
  }
  const opts = [
    [x - b.minX, -1, 0],
    [b.maxX - x, 1, 0],
    [z - b.minZ, 0, -1],
    [b.maxZ - z, 0, 1],
  ].sort((p, q) => p[0] - q[0])[0];
  return {
    x: opts[1] ? (opts[1] < 0 ? b.minX - r : b.maxX + r) : x,
    z: opts[2] ? (opts[2] < 0 ? b.minZ - r : b.maxZ + r) : z,
  };
}

export function resolveCircle(x: number, z: number, r: number, boxes: readonly Box2D[]): { x: number; z: number } {
  let p = { x, z };
  for (let pass = 0; pass < 3; pass++) {
    let hit = false;
    for (const b of boxes) {
      const q = pushOut(p.x, p.z, r, b);
      if (q) {
        p = q;
        hit = true;
      }
    }
    if (!hit) break;
  }
  return p;
}

export const movePlayer = (pos: { x: number; z: number }, dx: number, dz: number, boxes: readonly Box2D[], r = PLAYER_R) =>
  resolveCircle(pos.x + dx, pos.z + dz, r, boxes);
export const circleHitsBox = (x: number, z: number, r: number, b: Box2D) => pushOut(x, z, r, b) !== null;

export function placePoints(
  n: number,
  rng: () => number,
  {
    boxes = [],
    avoid = [],
    margin = 0.6,
    gap = 1.6,
    limit = 4.2,
  }: {
    boxes?: readonly Box2D[];
    avoid?: readonly { x: number; z: number; r?: number }[];
    margin?: number;
    gap?: number;
    limit?: number;
  } = {},
): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    let got: { x: number; z: number } | null = null;
    for (let t = 0; t < 300 && !got; t++) {
      const g = t > 200 ? gap * 0.5 : gap;
      const p = { x: (rng() * 2 - 1) * limit, z: (rng() * 2 - 1) * limit };
      if (boxes.some((b) => circleHitsBox(p.x, p.z, margin, b))) continue;
      if (avoid.some((a) => Math.hypot(a.x - p.x, a.z - p.z) < (a.r || 1.4))) continue;
      if (pts.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < g)) continue;
      got = p;
    }
    pts.push(got || { x: -3 + 1.5 * i, z: 1 });
  }
  return pts;
}

export interface RoomItem {
  id: string;
  x: number;
  z: number;
  color?: LanternColor;
  name?: FurnitureName;
  secret?: boolean;
}

export interface RoomLayout {
  index: number;
  kind: RoomKind;
  char: string;
  props: Box2D[];
  ghost: { x: number; z: number };
  door: { x: number; z: number; r: number };
  start: { x: number; z: number };
  order: string[] | null;
  items: RoomItem[];
  boxes: Box2D[];
}

export function makeRoom(index: number, rng: () => number = Math.random): RoomLayout {
  const kind = KINDS[index];
  const props = PROPS[index];
  const ghost = GHOST_AT[index];
  const avoid = [{ ...START, r: 1.6 }, { ...ghost, r: 1.4 }, { x: DOOR.x, z: DOOR.z, r: 1.4 }];
  let order: string[] | null = null;
  let items: RoomItem[] = [];
  if (kind === "items") {
    items = placePoints(COUNTS.items, rng, { boxes: props, avoid, gap: 1.8 }).map((p, i) => ({ id: `i${i}`, ...p }));
  } else if (kind === "lanterns") {
    items = placePoints(COUNTS.lanterns, rng, { boxes: props, avoid, gap: 2.4, margin: 0.7 }).map((p, i) => ({
      id: `l${i}`,
      color: LANTERN_COLORS[i],
      ...p,
    }));
    order = shuffle(
      items.map((it) => it.id),
      rng,
    );
  } else if (kind === "petals") {
    items = [1.9, -0.3, -2.4].map((z, i) => {
      let x = 0;
      for (let t = 0; t < 40; t++) {
        x = (rng() * 2 - 1) * 2.6;
        if (!props.some((b) => circleHitsBox(x, z, 0.7, b))) break;
        x = 0;
      }
      return { id: `p${i}`, x, z };
    });
  } else {
    const names = Object.keys(FURNITURE) as FurnitureName[];
    const spots = placePoints(names.length, rng, { avoid, gap: 2.5, margin: 1.0, limit: 3.9 });
    items = shuffle(names, rng).map((name, i) => ({ id: name, name, secret: FURNITURE[name].secret, ...spots[i] }));
  }
  const bodies =
    kind === "secrets"
      ? items.map((it) => {
          const [w, , d] = FURNITURE[it.name!].size;
          return box(it.x - w / 2, it.x + w / 2, it.z - d / 2, it.z + d / 2);
        })
      : [];
  return {
    index,
    kind,
    char: ROOM_CHARS[index],
    props,
    ghost,
    door: { ...DOOR },
    start: { ...START },
    order,
    items,
    boxes: [...WALLS, ...props, ...bodies],
  };
}

export type TouchResult = "ok" | "wrong" | "repeat" | "empty" | "ignore";

export interface RoomPuzzle {
  kind: RoomKind;
  total: number;
  count: () => number;
  done: () => boolean;
  found: (id: string) => boolean;
  visible: (id: string) => boolean;
  touch: (id: string) => TouchResult;
}

export function createPuzzle(layout: RoomLayout): RoomPuzzle {
  const ids = layout.items.map((it) => it.id);
  const found = new Set<string>();
  let step = 0;
  const target = layout.kind === "secrets" ? layout.items.filter((it) => it.secret).map((it) => it.id) : ids;
  const total = layout.kind === "lanterns" ? layout.order!.length : target.length;
  const api: RoomPuzzle = {
    kind: layout.kind,
    total,
    count: () => (layout.kind === "lanterns" || layout.kind === "petals" ? step : found.size),
    done: () => api.count() >= total,
    found: (id) => found.has(id),
    visible: (id) => (layout.kind === "items" ? !found.has(id) : layout.kind === "petals" ? !api.done() && id === ids[step] : true),
    touch(id: string): TouchResult {
      if (api.done() || !ids.includes(id)) return "ignore";
      if (layout.kind === "lanterns") {
        if (found.has(id)) return "repeat";
        if (id === layout.order![step]) {
          found.add(id);
          step++;
          return "ok";
        }
        found.clear();
        step = 0;
        return "wrong";
      }
      if (layout.kind === "petals") {
        if (id === ids[step]) {
          found.add(id);
          step++;
          return "ok";
        }
        return found.has(id) ? "repeat" : "ignore";
      }
      if (!target.includes(id)) return "empty";
      if (found.has(id)) return "repeat";
      found.add(id);
      return "ok";
    },
  };
  return api;
}

export function scoreOf(rooms: number, seconds: number): number {
  const n = clamp(Math.floor(rooms), 0, 4);
  const bonus = n >= 4 ? Math.round(BONUS_MAX * clamp((BONUS_SLOW - seconds) / (BONUS_SLOW - BONUS_FAST), 0, 1)) : 0;
  return n * PER_ROOM + bonus;
}

export interface HauntedRun {
  layouts: RoomLayout[];
  readonly room: number;
  readonly puzzle: RoomPuzzle;
  readonly layout: RoomLayout;
  readonly over: boolean;
  readonly time: number;
  readonly solvedCount: number;
  tick: (dt: number) => void;
  touch: (id: string) => { result: TouchResult; roomDone?: boolean; runDone?: boolean };
  canExit: () => boolean;
  next: () => boolean;
  leave: () => void;
  score: () => number;
  lastChar: () => string;
}

export function createRun(rng: () => number = Math.random): HauntedRun {
  const layouts = [0, 1, 2, 3].map((i) => makeRoom(i, rng));
  const solved = [false, false, false, false];
  let room = 0;
  let t = 0;
  let over = false;
  let puzzle = createPuzzle(layouts[0]);
  const run: HauntedRun = {
    layouts,
    get room() {
      return room;
    },
    get puzzle() {
      return puzzle;
    },
    get layout() {
      return layouts[room];
    },
    get over() {
      return over;
    },
    get time() {
      return t;
    },
    get solvedCount() {
      return solved.filter(Boolean).length;
    },
    tick(dt: number) {
      if (!over) t += Math.max(0, dt);
    },
    touch(id: string) {
      if (over || solved[room]) return { result: "ignore" };
      const result = puzzle.touch(id);
      if (!puzzle.done()) return { result };
      solved[room] = true;
      if (room === 3) over = true;
      return { result, roomDone: true, runDone: room === 3 };
    },
    canExit: () => !over && solved[room] && room < 3,
    next() {
      if (!run.canExit()) return false;
      room++;
      puzzle = createPuzzle(layouts[room]);
      return true;
    },
    leave() {
      over = true;
    },
    score: () => scoreOf(run.solvedCount, t),
    lastChar: () => ROOM_CHARS[room],
  };
  return run;
}
