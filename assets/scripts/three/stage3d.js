// 2.5D chat stage: a small low-poly backdrop (per ghost) behind the HTML speech bubble and ghost picture.
// mountStage3d(stageEl, char) -> { destroy() } or null when 3D is unavailable. The chat works the same without it.
import { canUse3D, createKit } from "./kit.js";

const SPECS = {
  "1": { name: "bamboo", background: "#1d2a22", fog: "#26382d", fogDensity: 0.09, layers: 3, props: 34, particles: "mist" },
  "2": { name: "corridor", background: "#16222a", fog: "#1d2e38", fogDensity: 0.07, layers: 3, props: 18, particles: "dust" },
  "3": { name: "garden", background: "#3a2a4a", fog: "#4a3560", fogDensity: 0.06, layers: 3, props: 30, particles: "petals" },
  "4": { name: "banyan", background: "#14201a", fog: "#1c2c22", fogDensity: 0.08, layers: 3, props: 26, particles: "fireflies" },
};

// Plain data for tests and for the builder. Unknown ids get the first ghost's backdrop.
export function sceneSpec(charId) {
  return { ...(SPECS[String(charId)] || SPECS["1"]) };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// px, py in -1..1 (pointer or device tilt from the stage centre); tilt = max degrees. Returns radians {yaw, pitch}, clamped.
export function parallaxAngles(px, py, tilt = 4) {
  const max = (clamp(Number(tilt) || 0, 0, 15) * Math.PI) / 180;
  const x = clamp(Number(px) || 0, -1, 1);
  const y = clamp(Number(py) || 0, -1, 1);
  return { yaw: -x * max, pitch: -y * max * 0.6 };
}

const CSS = `
.stage > :not(.stage3d):not(.history) { position: relative; z-index: 1; }
.stage.has-3d { background: none; }
.stage.has-3d .history { background: color-mix(in srgb, var(--accent) 28%, #fff); }
.stage3d { position: absolute; inset: 0; z-index: 0; pointer-events: none; border-radius: inherit; overflow: hidden; }
`;

// ---- scene builders: each returns nothing, adds meshes to kit.scene at several depths (z from -1 near to -14 far) ----
function builders(kit, spec, accent) {
  const T = kit.THREE;
  const mat = (color, extra = {}) => { const m = new T.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra }); kit.track(m); return m; };
  const mesh = (geo, m, x, y, z) => { kit.track(geo); const o = new T.Mesh(geo, m); o.position.set(x, y, z); kit.scene.add(o); return o; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const floor = (color, w = 40, d = 40) => { const f = mesh(new T.PlaneGeometry(w, d), mat(color), 0, 0, -8); f.rotation.x = -Math.PI / 2; return f; };
  const layerZ = (i) => -2 - (i * 12) / Math.max(1, spec.layers - 1) * 0.8 - i * 1.5;

  const make = {
    bamboo() {
      floor(0x24331f);
      const greens = [0x4f8a4a, 0x3f7a45, 0x66a35a].map((c) => mat(c));
      for (let i = 0; i < spec.props; i++) {
        const layer = i % spec.layers, z = layerZ(layer) + rnd(-1, 1), h = rnd(5, 8);
        const stalk = mesh(new T.CylinderGeometry(0.07, 0.09, h, 6), greens[i % 3], rnd(-6, 6), h / 2, z);
        stalk.rotation.z = rnd(-0.04, 0.04);
        for (let k = 1; k < 4; k++) mesh(new T.CylinderGeometry(0.1, 0.1, 0.05, 6), greens[0], stalk.position.x, k * h / 4, z);
      }
      kit.particles("mist", { count: 40, area: [12, 2.5, 10] });
    },
    corridor() {
      mesh(new T.PlaneGeometry(4, 30), mat(0x2b3a44), 0, 0, -12).rotation.x = -Math.PI / 2;
      mesh(new T.PlaneGeometry(4, 30), mat(0x34454f), 0, 3, -12).rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) { const w = mesh(new T.PlaneGeometry(30, 3), mat(0x3b5560), s * 2, 1.5, -12); w.rotation.y = -s * Math.PI / 2; }
      const lampM = new T.MeshBasicMaterial({ color: 0xeaffff }); kit.track(lampM);
      const doorM = mat(0x5b7f8c);
      for (let i = 0; i < spec.props / 3; i++) {
        const z = -1.5 - i * 2.2;
        mesh(new T.BoxGeometry(0.9, 0.06, 0.3), lampM, 0, 2.95, z);
        for (const s of [-1, 1]) if (i % 2 === (s > 0 ? 0 : 1)) mesh(new T.BoxGeometry(0.06, 2.1, 0.9), doorM, s * 1.97, 1.05, z - 1);
      }
      mesh(new T.PlaneGeometry(4, 3), mat(0x4a6a76), 0, 1.5, -26);
      kit.particles("dust", { count: 40, area: [3, 3, 14] });
    },
    garden() {
      floor(0x4c6b3a);
      const wallM = mat(0xb9a9c9);
      for (let i = 0; i < 3; i++) mesh(new T.BoxGeometry(5, 0.7, 0.4), wallM, -5 + i * 5.1, 0.35, layerZ(2));
      const stemM = mat(0x3f7a3a);
      const colors = [accent, 0xf4a6c8, 0xffe08a, 0xffffff].map((c) => mat(c));
      for (let i = 0; i < spec.props; i++) {
        const z = layerZ(i % spec.layers) + rnd(-1, 1), x = rnd(-6, 6);
        mesh(new T.CylinderGeometry(0.02, 0.02, 0.5, 4), stemM, x, 0.25, z);
        mesh(new T.ConeGeometry(0.15, 0.2, 6), colors[i % 4], x, 0.58, z);
      }
      const p = kit.particles("dust", { count: 50, area: [10, 4, 8] }); // petals: pink dust, a bit bigger
      p.material.color.set(0xffb6d2); p.material.size = 0.1; p.material.opacity = 0.85;
    },
    banyan() {
      floor(0x2a2418);
      const bark = mat(0x4a3a28), root = mat(0x5a4632);
      mesh(new T.CylinderGeometry(0.9, 1.4, 7, 7), bark, -1.2, 3.5, layerZ(2));
      mesh(new T.CylinderGeometry(0.5, 0.8, 7, 7), bark, 2.8, 3.5, layerZ(1) - 1);
      mesh(new T.ConeGeometry(5, 2.5, 7), mat(0x1f3a26), 0, 7.2, layerZ(2));
      for (let i = 0; i < spec.props; i++) {
        const len = rnd(2, 5), z = layerZ(i % spec.layers) + rnd(-1, 1);
        mesh(new T.CylinderGeometry(0.03, 0.05, len, 4), root, rnd(-5, 5), 6 - len / 2, z);
      }
      kit.particles("fireflies", { count: 40, area: [9, 3, 8] });
    },
  };
  return make[spec.name] || make.bamboo;
}

export async function mountStage3d(stageEl, char) {
  let kit = null, host = null, style = null, cleanup = [];
  const destroy = () => {
    for (const fn of cleanup.splice(0)) { try { fn(); } catch {} }
    try { kit?.destroy(); } catch {}
    host?.remove(); style?.remove();
    stageEl?.classList?.remove("has-3d");
    kit = host = style = null;
  };
  try {
    if (!stageEl || !canUse3D()) return null;
    const spec = sceneSpec(char?.id);
    host = document.createElement("div");
    host.className = "stage3d";
    stageEl.prepend(host);
    if (!document.getElementById("css-stage3d")) {
      style = document.createElement("style");
      style.id = "css-stage3d";
      style.textContent = CSS;
      document.head.append(style);
    }
    kit = await createKit(host, { accent: char?.accent || "#a47fd0", fogColor: spec.fog, background: spec.background, fog: spec.fogDensity });
    kit.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    kit.resize();
    const accent = new kit.THREE.Color(char?.accent || "#a47fd0").getHex();
    builders(kit, spec, accent)();

    // damped parallax: the camera drifts a few degrees around its base pose
    const cam = kit.camera;
    cam.position.set(0, 1.5, 4);
    const base = { x: 0, y: 1.5, z: 4 };
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    const setTarget = (px, py) => { target.x = px; target.y = py; };
    const onMove = (e) => {
      const r = stageEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      setTarget(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const onTilt = (e) => { if (e.gamma == null || e.beta == null) return; setTarget(clamp(e.gamma / 30, -1, 1), clamp((e.beta - 50) / 30, -1, 1)); };
    stageEl.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    cleanup.push(() => stageEl.removeEventListener("pointermove", onMove), () => window.removeEventListener("deviceorientation", onTilt));

    let acc = 0;
    kit.add((dt, t) => {
      acc += dt;
      const k = 1 - Math.exp(-dt * 4);
      cur.x += (target.x - cur.x) * k; cur.y += (target.y - cur.y) * k;
      const a = parallaxAngles(cur.x, cur.y, 4);
      cam.position.set(base.x - a.yaw * 6, base.y + a.pitch * 3, base.z);
      cam.rotation.set(a.pitch * 0.5, a.yaw * 0.5, 0);
      cam.updateMatrixWorld();
    });
    // ~30 fps cap: wrap the renderer so alternate frames skip the draw (the kit still ticks cheaply)
    const render = kit.renderer.render.bind(kit.renderer);
    let skip = false;
    kit.renderer.render = (s, c) => { skip = !skip; if (!skip) render(s, c); };
    kit.start();
    return { destroy };
  } catch (err) {
    try { destroy(); } catch {}
    return null;
  }
}
