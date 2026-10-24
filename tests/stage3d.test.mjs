import test from "node:test";
import assert from "node:assert/strict";
import { sceneSpec, parallaxAngles } from "../assets/scripts/three/stage3d.js";

test("sceneSpec has a distinct backdrop per ghost", () => {
  const names = ["1", "2", "3", "4"].map((id) => sceneSpec(id).name);
  assert.equal(new Set(names).size, 4);
  for (const id of ["1", "2", "3", "4"]) {
    const s = sceneSpec(id);
    assert.ok(s.layers >= 2 && s.props > 0 && s.fogDensity > 0);
    assert.match(s.background, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(sceneSpec(2).name, "corridor");
  assert.equal(sceneSpec("zzz").name, sceneSpec("1").name);
});

test("parallaxAngles is zero at centre, clamped and signed", () => {
  const z = parallaxAngles(0, 0, 4);
  assert.equal(z.yaw + 0, 0);
  assert.equal(z.pitch + 0, 0);
  const max = (4 * Math.PI) / 180;
  assert.ok(Math.abs(parallaxAngles(99, 99, 4).yaw) <= max + 1e-9);
  assert.ok(Math.abs(parallaxAngles(-99, -99, 4).pitch) <= max + 1e-9);
  assert.ok(parallaxAngles(1, 0, 4).yaw < 0 && parallaxAngles(-1, 0, 4).yaw > 0);
  assert.deepEqual(parallaxAngles(NaN, undefined, 4), { yaw: 0, pitch: 0 }.constructor === Object ? parallaxAngles(0, 0, 4) : null);
  assert.ok(Math.abs(parallaxAngles(1, 1, 500).yaw) <= (15 * Math.PI) / 180 + 1e-9);
});
