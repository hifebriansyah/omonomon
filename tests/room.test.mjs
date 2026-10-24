import test from "node:test";
import assert from "node:assert/strict";
import { furnitureSlots, wallPalette, GHOST_SPOTS } from "../assets/scripts/three/room.js";

test("furnitureSlots keeps known ids, drops unknown and duplicates, stable order", () => {
  const s = furnitureSlots(["furn-bed", "nope", "furn-lamp", "furn-bed", "frame-gold"]);
  assert.deepEqual(s.map((x) => x.id), ["furn-bed", "furn-lamp"]);
  for (const x of s) assert.ok(Number.isFinite(x.x + x.y + x.z));
  assert.deepEqual(furnitureSlots(), []);
  assert.deepEqual(furnitureSlots(["toString", "__proto__"]), []);
});

test("every furniture id has a slot inside the room", () => {
  const ids = ["furn-lamp", "furn-rug", "furn-poster", "furn-plant", "furn-window", "furn-bed"];
  const s = furnitureSlots(ids);
  assert.equal(s.length, ids.length);
  for (const x of s) assert.ok(Math.abs(x.x) <= 3 && Math.abs(x.z) <= 3);
});

test("wallPalette maps stages, defaults otherwise", () => {
  const d = wallPalette("");
  assert.deepEqual(wallPalette("none"), d);
  assert.deepEqual(wallPalette(undefined), d);
  assert.deepEqual(wallPalette("hasOwnProperty"), d);
  const walls = new Set(["stage-stripes", "stage-grid", "stage-stars", "stage-dusk"].map((k) => wallPalette(k).wall));
  assert.equal(walls.size, 4);
  assert.ok(!walls.has(d.wall));
});

test("four ghost spots", () => assert.equal(GHOST_SPOTS.length, 4));
