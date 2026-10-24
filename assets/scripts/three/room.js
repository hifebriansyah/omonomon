// Kamar Hantu (Ghost Room): a small low-poly room built from boxes/cylinders/cones, one slot per furniture piece, the four ghosts as
// company, a slowly orbiting camera you can nudge by dragging. 3D when possible, a flat SVG cutaway otherwise.
// Contract: export async function mountRoom(root, { items, accent, stage, chars, lang, T }) -> { destroy() }
import { canUse3D, createKit } from "./kit.js";

// ---- pure helpers (no DOM / three access) ----
// 3D slot: x,y,z in room units (floor is y=0, back wall z=-3, left wall x=-3); rot = y rotation. 2D: fx,fy in the 400x260 SVG.
const SLOTS = {
  "furn-lamp": { x: -2.2, y: 0, z: -2.2, rot: 0 },
  "furn-rug": { x: 0.4, y: 0.02, z: 0.4, rot: 0 },
  "furn-poster": { x: 0.7, y: 2.0, z: -2.92, rot: 0 },
  "furn-plant": { x: 2.3, y: 0, z: -2.2, rot: 0 },
  "furn-window": { x: -2.92, y: 1.9, z: -0.7, rot: Math.PI / 2 },
  "furn-bed": { x: -2.0, y: 0, z: 1.3, rot: 0 },
};
export const GHOST_SPOTS = [[-0.9, 1.15, -1.6], [1.3, 1.0, -0.7], [0.2, 0.95, 1.5], [2.0, 1.2, 1.3]];

export function furnitureSlots(items) {
  const seen = new Set();
  const out = [];
  for (const id of items || []) {
    if (!Object.hasOwn(SLOTS, id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, ...SLOTS[id] });
  }
  return out;
}

const PALETTES = {
  default: { wall: "#5b4a86", floor: "#3a2f55", fog: "#15142b", bg: "#0e0d1f", trim: "#7a68a8" },
  "stage-stripes": { wall: "#7a4a6a", floor: "#4a2c40", fog: "#241322", bg: "#170c16", trim: "#a86f90" },
  "stage-grid": { wall: "#4a6a86", floor: "#2c3f55", fog: "#122030", bg: "#0b1520", trim: "#7aa0c0" },
  "stage-stars": { wall: "#2f3a7a", floor: "#222a55", fog: "#0c1030", bg: "#070a22", trim: "#6a78c8" },
  "stage-dusk": { wall: "#7a4a3a", floor: "#45281f", fog: "#2a1512", bg: "#1a0c0a", trim: "#c08060" },
};
export function wallPalette(stage) {
  return PALETTES[Object.hasOwn(PALETTES, stage || "") ? stage : "default"];
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TXT = { en: "Drag to look around", id: "Geser untuk melihat sekeliling" };

const CSS = `
.room-wrap{position:relative;width:100%;height:100%;min-height:260px}
.room-hint{position:absolute;left:0;right:0;bottom:8px;text-align:center;font:12px/1.2 system-ui,sans-serif;color:#dfe6ffaa;pointer-events:none}
.room2d{position:relative;width:100%;max-width:640px;aspect-ratio:400/260;margin:0 auto}
.room2d svg{position:absolute;inset:0;width:100%;height:100%}
.room2d img{position:absolute;width:15%;height:auto;transform:translateX(-50%);filter:drop-shadow(0 0 8px var(--ra,#a47fd0));animation:room-bob 3.4s ease-in-out infinite}
@keyframes room-bob{50%{transform:translate(-50%,-6px)}}
@media (prefers-reduced-motion:reduce){.room2d img{animation:none}}`;

// ---- 2D fallback ----
const SHAPES = {
  "furn-window": `<rect x="58" y="43" width="84" height="84" rx="3" fill="#6a5a90"/><rect x="64" y="49" width="72" height="72" fill="#0b1238"/><circle cx="114" cy="72" r="9" fill="#f4f0c8"/><circle cx="118" cy="69" r="8" fill="#0b1238"/><g fill="#fff"><circle cx="78" cy="62" r="1.5"/><circle cx="96" cy="100" r="1.5"/><circle cx="124" cy="104" r="1.2"/><circle cx="82" cy="88" r="1.2"/></g><path d="M100 49v72M64 85h72" stroke="#6a5a90" stroke-width="3"/>`,
  "furn-poster": `<rect x="238" y="48" width="62" height="82" fill="#e8dcc0" stroke="#7a6a50" stroke-width="3"/><rect x="244" y="54" width="50" height="70" fill="#2a2658"/><circle cx="269" cy="80" r="11" fill="#f4f0c8"/><path d="M257 124v-18q12-18 24 0v18l-4-4-4 4-4-4-4 4-4-4z" fill="#fff" opacity=".9"/>`,
  "furn-lamp": `<circle cx="205" cy="150" r="46" fill="#ffc27a" opacity=".16"/><rect x="203" y="150" width="4" height="78" fill="#4a3a2a"/><ellipse cx="205" cy="229" rx="14" ry="4" fill="#4a3a2a"/><path d="M190 152l6-24h18l6 24z" fill="#ffd89a"/>`,
  "furn-rug": `<ellipse cx="140" cy="228" rx="112" ry="20" fill="#a0405a"/><ellipse cx="140" cy="228" rx="84" ry="14" fill="none" stroke="#e8b0a0" stroke-width="3"/><ellipse cx="140" cy="228" rx="52" ry="8" fill="#7a2c44"/>`,
  "furn-plant": `<path d="M24 190q-18-30 0-48q4 30 10 38zM30 190q4-34 24-42q-6 30-16 42zM28 190q-2-40 6-56q10 24 0 56z" fill="#4a9a5a"/><path d="M14 190h28l-4 36H18z" fill="#b86a4a"/>`,
  "furn-bed": `<rect x="262" y="176" width="124" height="46" rx="4" fill="#7a5a3a"/><rect x="266" y="164" width="120" height="30" rx="6" fill="#d8d0f0"/><rect x="266" y="176" width="86" height="22" rx="4" fill="#7a68c8"/><rect x="270" y="166" width="30" height="14" rx="6" fill="#fff"/><rect x="262" y="222" width="6" height="10" fill="#4a3a2a"/><rect x="380" y="222" width="6" height="10" fill="#4a3a2a"/>`,
};
const ORDER_2D = ["furn-window", "furn-poster", "furn-rug", "furn-lamp", "furn-plant", "furn-bed"]; // back to front

function mount2D(root, { items, accent, stage, chars }) {
  const p = wallPalette(stage);
  const owned = new Set(furnitureSlots(items).map((s) => s.id));
  const svg = `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet" role="img"><rect width="400" height="260" fill="${p.bg}"/><rect x="10" y="10" width="380" height="188" fill="${p.wall}"/><path d="M10 198h380l10 52H0z" fill="${p.floor}"/><rect x="10" y="194" width="380" height="6" fill="${p.trim}"/>${ORDER_2D.filter((id) => owned.has(id)).map((id) => SHAPES[id]).join("")}</svg>`;
  const ghosts = (chars || []).slice(0, 4).map((c, i) => `<img src="${c.stage || c.head || ""}" alt="" style="left:${[16, 38, 62, 86][i]}%;top:${[52, 60, 54, 62][i]}%;animation-delay:${i * 0.6}s">`).join("");
  root.innerHTML = `<div class="room2d" style="--ra:${accent || "#a47fd0"}">${svg}${ghosts}</div>`;
}

// ---- 3D ----
function mount3D(kit, root, { items, stage, chars, lang }) {
  const { THREE, scene, camera } = kit;
  const p = wallPalette(stage);
  const geos = new Map();
  const mats = new Map();
  const G = (k, make) => { let g = geos.get(k); if (!g) { g = make(); geos.set(k, g); kit.track(g); } return g; };
  const M = (color, extra) => {
    const k = color + (extra ? JSON.stringify(extra) : "");
    let m = mats.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial({ color, ...extra }); mats.set(k, m); kit.track(m); }
    return m;
  };
  const box = (parent, w, h, d, color, x, y, z, extra) => {
    const m = new THREE.Mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), M(color, extra));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cyl = (parent, rt, rb, h, color, x, y, z, seg = 12) => {
    const m = new THREE.Mesh(G(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), M(color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const canvasTex = (w, h, draw) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    kit.track(t);
    return t;
  };

  // shell: floor + two walls, open toward the camera
  box(scene, 6, 0.2, 6, p.floor, 0, -0.1, 0);
  box(scene, 6.3, 3.2, 0.15, p.wall, 0, 1.6, -3.075);
  box(scene, 0.15, 3.2, 6, p.wall, -3.075, 1.6, 0);
  box(scene, 6, 0.14, 0.06, p.trim, 0, 0.07, -2.97);
  box(scene, 0.06, 0.14, 6, p.trim, -2.97, 0.07, 0);

  let lampPos = null;
  const builders = {
    "furn-lamp(g)": (g) => {
      cyl(g, 0.22, 0.26, 0.06, "#4a3a2a", 0, 0.03, 0);
      cyl(g, 0.03, 0.03, 1.4, "#4a3a2a", 0, 0.75, 0, 6);
      const shade = cyl(g, 0.18, 0.32, 0.4, "#ffd89a", 0, 1.6, 0, 10);
      shade.material = M("#ffd89a", { emissive: "#ffb050", emissiveIntensity: 0.9 });
      const light = new THREE.PointLight(0xffc27a, 2.4, 9, 1.4);
      light.position.set(0, 1.55, 0);
      g.add(light);
      lampPos = g.position;
    },
    "furn-rug(g)": (g) => {
      const r = cyl(g, 1.3, 1.3, 0.04, "#a0405a", 0, 0, 0, 24);
      r.scale.z = 0.7;
      const r2 = cyl(g, 0.95, 0.95, 0.05, "#e8b0a0", 0, 0, 0, 24);
      r2.scale.z = 0.7;
      const r3 = cyl(g, 0.7, 0.7, 0.06, "#7a2c44", 0, 0, 0, 24);
      r3.scale.z = 0.7;
    },
    "furn-poster(g)": (g) => {
      const tex = canvasTex(128, 176, (c, w, h) => {
        c.fillStyle = "#e8dcc0"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#2a2658"; c.fillRect(8, 8, w - 16, h - 16);
        c.fillStyle = "#f4f0c8"; c.beginPath(); c.arc(64, 64, 26, 0, 6.3); c.fill();
        c.fillStyle = "#2a2658"; c.beginPath(); c.arc(74, 58, 24, 0, 6.3); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.moveTo(40, 160); c.lineTo(40, 118); c.quadraticCurveTo(64, 82, 88, 118); c.lineTo(88, 160);
        c.lineTo(76, 148); c.lineTo(64, 160); c.lineTo(52, 148); c.closePath(); c.fill();
        c.fillStyle = "#2a2658"; c.fillRect(54, 120, 5, 8); c.fillRect(70, 120, 5, 8);
      });
      box(g, 0.9, 1.25, 0.05, "#7a6a50", 0, 0, 0);
      const pic = new THREE.Mesh(G("poster", () => new THREE.PlaneGeometry(0.8, 1.1)), new THREE.MeshBasicMaterial({ map: tex }));
      pic.position.z = 0.03;
      kit.track(pic.material);
      g.add(pic);
    },
    "furn-plant(g)": (g) => {
      cyl(g, 0.3, 0.22, 0.42, "#b86a4a", 0, 0.21, 0);
      cyl(g, 0.27, 0.27, 0.04, "#3a2a20", 0, 0.42, 0);
      const leaf = G("leaf", () => new THREE.ConeGeometry(0.1, 0.8, 5));
      for (let i = 0; i < 5; i++) {
        const l = new THREE.Mesh(leaf, M(i % 2 ? "#4a9a5a" : "#3a8a50"));
        const a = (i / 5) * 6.283;
        l.position.set(Math.cos(a) * 0.12, 0.8, Math.sin(a) * 0.12);
        l.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
        g.add(l);
      }
    },
    "furn-window(g)": (g) => {
      const tex = canvasTex(128, 128, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "#050a28"); gr.addColorStop(1, "#2a2a68");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = "#fff";
        for (let i = 0; i < 26; i++) c.fillRect((i * 53) % w, (i * 37 + i * i) % h, i % 4 ? 1.5 : 2.5, i % 4 ? 1.5 : 2.5);
        c.fillStyle = "#f4f0c8"; c.beginPath(); c.arc(88, 38, 13, 0, 6.3); c.fill();
        c.fillStyle = "#14184a"; c.beginPath(); c.arc(95, 34, 12, 0, 6.3); c.fill();
      });
      const sky = new THREE.Mesh(G("sky", () => new THREE.PlaneGeometry(1.25, 1.25)), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
      sky.position.z = 0.02;
      kit.track(sky.material);
      g.add(sky);
      box(g, 1.45, 0.1, 0.1, "#6a5a90", 0, 0.68, 0.03);
      box(g, 1.45, 0.1, 0.1, "#6a5a90", 0, -0.68, 0.03);
      box(g, 0.1, 1.45, 0.1, "#6a5a90", 0.68, 0, 0.03);
      box(g, 0.1, 1.45, 0.1, "#6a5a90", -0.68, 0, 0.03);
      box(g, 0.06, 1.3, 0.06, "#6a5a90", 0, 0, 0.04);
      box(g, 1.3, 0.06, 0.06, "#6a5a90", 0, 0, 0.04);
    },
    "furn-bed(g)": (g) => {
      box(g, 1.5, 0.3, 2.3, "#7a5a3a", 0, 0.2, 0);
      box(g, 1.4, 0.2, 2.2, "#d8d0f0", 0, 0.45, 0);
      box(g, 1.42, 0.12, 1.4, "#7a68c8", 0, 0.58, 0.4);
      box(g, 0.9, 0.16, 0.5, "#ffffff", 0, 0.62, -0.85);
      box(g, 1.5, 0.9, 0.1, "#7a5a3a", 0, 0.6, -1.2);
    },
  };
  for (const s of furnitureSlots(items)) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = s.rot;
    scene.add(g);
    builders[`${s.id}(g)`]?.(g);
  }

  // lights: the kit's lantern goes warm and dim when a real lamp exists
  kit.lights.lantern.intensity = lampPos ? 0.5 : 1.4;
  kit.lights.lantern.position.set(0, 2.2, 3);

  // ghosts (their pictures), bobbing in fixed spots
  const ghosts = [];
  (chars || []).slice(0, 4).forEach((c, i) => {
    const gh = kit.ghost(c.stage || c.head, 1.3);
    gh.position.set(...GHOST_SPOTS[i]);
    ghosts.push(gh);
  });
  kit.add((dt, t) => {
    for (let i = 0; i < ghosts.length; i++) ghosts[i].position.y = GHOST_SPOTS[i][1] + Math.sin(t * 1.2 + i * 1.7) * 0.08;
  });

  kit.particles("dust", { count: 50, area: [6, 3, 6] }).position.set(0, 0, 2);
  const ff = kit.particles("fireflies", { count: 14, area: [3, 1.8, 3] });
  ff.position.set(lampPos ? lampPos.x : 0, 0.5, (lampPos ? lampPos.z : 0) + 2);

  // orbiting camera, nudged by dragging (angles clamped, damped)
  const target = new THREE.Vector3(0, 1.1, -0.2);
  let offAz = 0, offEl = 0, tAz = 0, tEl = 0, drag = null;
  const R = 8;
  kit.add((dt, t) => {
    const k = 1 - Math.exp(-dt * 5);
    offAz += (tAz - offAz) * k;
    offEl += (tEl - offEl) * k;
    const az = 0.6 + Math.sin(t * 0.12) * 0.2 + offAz;
    const el = 0.38 + offEl;
    camera.position.set(target.x + R * Math.sin(az) * Math.cos(el), target.y + R * Math.sin(el), target.z + R * Math.cos(az) * Math.cos(el));
    camera.lookAt(target);
  });
  const down = (e) => { drag = { x: e.clientX, y: e.clientY, a: tAz, e: tEl }; try { root.setPointerCapture(e.pointerId); } catch {} };
  const move = (e) => {
    if (!drag) return;
    tAz = clamp(drag.a - (e.clientX - drag.x) * 0.006, -0.45, 0.45);
    tEl = clamp(drag.e + (e.clientY - drag.y) * 0.004, -0.15, 0.3);
  };
  const up = () => { drag = null; };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);

  const hint = document.createElement("div");
  hint.className = "room-hint";
  hint.textContent = TXT[lang] || TXT.en;
  root.append(hint);

  kit.start();
  return () => {
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerup", up);
    root.removeEventListener("pointercancel", up);
    hint.remove();
    kit.destroy();
  };
}

export async function mountRoom(root, opts = {}) {
  const style = document.createElement("style");
  style.id = "css-room";
  style.textContent = CSS;
  document.head.append(style);
  const o = { items: [], accent: "#a47fd0", stage: "", chars: [], lang: "en", ...opts };
  let cleanup = null;
  if (canUse3D()) {
    try {
      const p = wallPalette(o.stage);
      const kit = await createKit(root, { accent: o.accent, fogColor: p.fog, background: p.bg, fog: 0.035 });
      try { cleanup = mount3D(kit, root, o); } catch (e) { kit.destroy(); throw e; }
    } catch (e) {
      console.warn("room: 3D unavailable, using 2D", e);
      cleanup = null;
    }
  }
  if (!cleanup) {
    mount2D(root, o);
    cleanup = () => { root.textContent = ""; };
  }
  return {
    destroy() {
      cleanup?.();
      cleanup = null;
      style.remove();
    },
  };
}
