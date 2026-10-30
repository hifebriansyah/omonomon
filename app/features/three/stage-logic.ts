// The pure parts of the 3D chat backdrop (no DOM, no three): one backdrop per ghost and the parallax maths.
// tests/legacy/stage3d.test.mjs is the spec.

export type SceneName = "bamboo" | "corridor" | "garden" | "banyan";
export type ParticleKind = "fireflies" | "dust" | "mist" | "petals";
export interface SceneSpec {
  name: SceneName;
  background: string;
  fog: string;
  fogDensity: number;
  layers: number;
  props: number;
  particles: ParticleKind;
}

const SPECS: Record<string, SceneSpec> = {
  "1": { name: "bamboo", background: "#1d2a22", fog: "#26382d", fogDensity: 0.09, layers: 3, props: 34, particles: "mist" },
  "2": { name: "corridor", background: "#16222a", fog: "#1d2e38", fogDensity: 0.07, layers: 3, props: 18, particles: "dust" },
  "3": { name: "garden", background: "#3a2a4a", fog: "#4a3560", fogDensity: 0.06, layers: 3, props: 30, particles: "petals" },
  "4": { name: "banyan", background: "#14201a", fog: "#1c2c22", fogDensity: 0.08, layers: 3, props: 26, particles: "fireflies" },
};

// Plain data for tests and for the builder. Unknown ids get the first ghost's backdrop.
export function sceneSpec(charId?: string | number | null): SceneSpec {
  const key = String(charId);
  return { ...(Object.hasOwn(SPECS, key) ? SPECS[key] : SPECS["1"]) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// px, py in -1..1 (pointer or device tilt from the stage centre); tilt = max degrees. Returns radians {yaw, pitch}, clamped.
export function parallaxAngles(px: unknown, py: unknown, tilt: unknown = 4): { yaw: number; pitch: number } {
  const max = (clamp(Number(tilt) || 0, 0, 15) * Math.PI) / 180;
  const x = clamp(Number(px) || 0, -1, 1);
  const y = clamp(Number(py) || 0, -1, 1);
  return { yaw: -x * max, pitch: -y * max * 0.6 };
}
