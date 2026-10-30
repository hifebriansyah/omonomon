// The pure parts of the Ghost Room (no DOM, no three): where each piece of furniture stands, where the ghosts float, and the
// wall colours of each chat stage look. tests/legacy/room.test.mjs is the spec.

export interface Slot {
  x: number;
  y: number;
  z: number;
  rot: number;
}
export interface PlacedSlot extends Slot {
  id: string;
}
export interface Palette {
  wall: string;
  floor: string;
  fog: string;
  bg: string;
  trim: string;
}

// 3D slot: x,y,z in room units (floor is y=0, back wall z=-3, left wall x=-3); rot = y rotation.
const SLOTS: Record<string, Slot> = {
  "furn-lamp": { x: -2.2, y: 0, z: -2.2, rot: 0 },
  "furn-rug": { x: 0.4, y: 0.02, z: 0.4, rot: 0 },
  "furn-poster": { x: 0.7, y: 2.0, z: -2.92, rot: 0 },
  "furn-plant": { x: 2.3, y: 0, z: -2.2, rot: 0 },
  "furn-window": { x: -2.92, y: 1.9, z: -0.7, rot: Math.PI / 2 },
  "furn-bed": { x: -2.0, y: 0, z: 1.3, rot: 0 },
};
export const GHOST_SPOTS: [number, number, number][] = [
  [-0.9, 1.15, -1.6],
  [1.3, 1.0, -0.7],
  [0.2, 0.95, 1.5],
  [2.0, 1.2, 1.3],
];

// Known furniture only, each once, in the order given.
export function furnitureSlots(items?: readonly string[] | null): PlacedSlot[] {
  const seen = new Set<string>();
  const out: PlacedSlot[] = [];
  for (const id of items || []) {
    if (!Object.hasOwn(SLOTS, id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, ...SLOTS[id] });
  }
  return out;
}

const PALETTES: Record<string, Palette> = {
  default: { wall: "#5b4a86", floor: "#3a2f55", fog: "#15142b", bg: "#0e0d1f", trim: "#7a68a8" },
  "stage-stripes": { wall: "#7a4a6a", floor: "#4a2c40", fog: "#241322", bg: "#170c16", trim: "#a86f90" },
  "stage-grid": { wall: "#4a6a86", floor: "#2c3f55", fog: "#122030", bg: "#0b1520", trim: "#7aa0c0" },
  "stage-stars": { wall: "#2f3a7a", floor: "#222a55", fog: "#0c1030", bg: "#070a22", trim: "#6a78c8" },
  "stage-dusk": { wall: "#7a4a3a", floor: "#45281f", fog: "#2a1512", bg: "#1a0c0a", trim: "#c08060" },
};
export function wallPalette(stage?: string | null): Palette {
  return PALETTES[Object.hasOwn(PALETTES, stage || "") ? (stage as string) : "default"];
}
