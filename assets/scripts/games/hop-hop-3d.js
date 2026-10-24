// Hop Hop 3D (Lompat Kubur): a three-lane endless runner through a graveyard. Pocomon runs away from the camera; tombstones and
// crosses (low: hop over them) and hanging branches (high: do NOT hop, or change lane) come at her. Falls back to the 2D Hop Hop.
// The rules (spawning, collisions, score) are pure and exported; the three.js layer is only used inside start().
import { startRunner } from "./runner.js";

// ---------- pure rules ----------
export const LANES = [-1, 0, 1];
export const LANE_W = 1.6;
export const SPEED0 = 8;          // world units / second at the start
export const SPEED_MAX = 19;
export const ACCEL = 0.2;         // units/s gained every second
export const SCORE_K = 1.25;      // score = floor(distance * K): ~10 points/s at first, ~24/s at top speed
export const GRAV = 20;
export const HOP_V = 7;           // 0.7 s in the air, peak about 1.2
export const SPAWN_AHEAD = 55;
export const PLAYER = { hw: 0.3, hd: 0.25, h: 0.95 };
// Obstacle boxes: y from h0 to h1, half width hw, half depth hd. "low" ones are hopped over, the branch is walked under.
export const KINDS = {
  tomb: { h0: 0, h1: 0.7, hw: 0.45, hd: 0.3 },
  cross: { h0: 0, h1: 0.8, hw: 0.3, hd: 0.2 },
  branch: { h0: 1.0, h1: 2.4, hw: 0.75, hd: 0.3 },
};

export const scoreOf = (distance) => Math.max(0, Math.floor(distance * SCORE_K));
export const speedAt = (t) => Math.min(SPEED_MAX, SPEED0 + ACCEL * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// One row of obstacles across the 3 lanes: [kind|null, kind|null, kind|null]. Always leaves at least one lane clear.
export function planRow(rng, speed = SPEED0) {
  const diff = clamp((speed - SPEED0) / (SPEED_MAX - SPEED0), 0, 1);
  const row = [null, null, null];
  const free = Math.min(2, Math.floor(rng() * 3));
  const blocked = [0, 1, 2].filter((i) => i !== free);
  const n = rng() < 0.25 + 0.35 * diff ? 2 : 1;
  if (n === 1) blocked.splice(Math.min(1, Math.floor(rng() * 2)), 1);
  for (const i of blocked) {
    const r = rng();
    row[i] = r < 0.2 + 0.15 * diff ? "branch" : r < 0.65 ? "tomb" : "cross";
  }
  return row;
}

// Distance between rows grows with speed so there is always about 1.1 to 1.8 s between them.
export const rowGap = (speed, rng) => speed * (1.1 + rng() * 0.7);

// Pushes the obstacles of every row whose distance is <= upto into `out` (mutates state.next and out).
export function spawnAhead(state, upto, speed, rng, out) {
  while (state.next <= upto) {
    const row = planRow(rng, speed);
    for (let i = 0; i < 3; i++) if (row[i]) out.push({ d: state.next, lane: LANES[i], kind: row[i] });
    state.next += rowGap(speed, rng);
  }
  return out;
}

// p = { x, y, d } (player position: lane x, height above ground, distance run); o = { d, lane, kind }
export function collides(p, o) {
  const k = KINDS[o.kind];
  return Math.abs(p.x - o.lane * LANE_W) < k.hw + PLAYER.hw
    && Math.abs(p.d - o.d) < k.hd + PLAYER.hd
    && p.y < k.h1 && p.y + PLAYER.h > k.h0;
}

export function createEngine({ rng = Math.random } = {}) {
  const e = { t: 0, d: 0, speed: SPEED0, lane: 0, x: 0, y: 0, vy: 0, over: false, score: 0, obs: [], spawn: { next: 30 } };
  e.moveLane = (dir) => { if (!e.over) e.lane = clamp(e.lane + dir, -1, 1); };
  e.hop = () => { if (e.over || e.y !== 0 || e.vy !== 0) return false; e.vy = HOP_V; return true; };
  function sub(dt) {
    e.t += dt;
    e.speed = speedAt(e.t);
    e.d += e.speed * dt;
    const dx = e.lane * LANE_W - e.x;
    e.x += clamp(dx, -14 * dt, 14 * dt);
    if (e.vy !== 0 || e.y > 0) {
      e.vy -= GRAV * dt;
      e.y += e.vy * dt;
      if (e.y <= 0) { e.y = 0; e.vy = 0; }
    }
    spawnAhead(e.spawn, e.d + SPAWN_AHEAD, e.speed, rng, e.obs);
    let n = 0;
    for (let i = 0; i < e.obs.length; i++) if (e.obs[i].d > e.d - 4) e.obs[n++] = e.obs[i];
    e.obs.length = n;
    for (let i = 0; i < n; i++) if (collides(e, e.obs[i])) { e.over = true; break; }
    e.score = scoreOf(e.d);
  }
  e.step = (dt) => {
    let left = Math.min(dt, 0.1);
    while (left > 1e-9 && !e.over) { const s = Math.min(left, 1 / 60); sub(s); left -= s; }
    return e;
  };
  return e;
}

// ---------- text ----------
const TEXT = {
  en: { hint: "Swipe or arrows to change lane. Tap or Space to hop. Do not hop under branches.", best: "Best", fall: "Tap or press Space to hop" },
  id: { hint: "Geser atau panah untuk pindah jalur. Tap atau Spasi untuk lompat. Jangan lompat di bawah dahan.", best: "Terbaik", fall: "Tap atau tekan Spasi untuk melompat" },
};

const CSS = `
.hh3{position:relative;overflow:hidden;background:#0e0d22;touch-action:none;user-select:none;-webkit-user-select:none}
.hh3 canvas{outline:none}
.hh3-hud{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;padding:10px 14px;pointer-events:none;color:#fff;font-family:var(--comic,inherit);text-shadow:0 1px 4px #000}
.hh3-score{font-size:30px;line-height:1;color:var(--accent,#a47fd0)}
.hh3-best{font-size:14px;opacity:.8;align-self:center}
.hh3-hint{position:absolute;left:12%;right:12%;bottom:14%;text-align:center;color:#fff;font-size:14px;pointer-events:none;text-shadow:0 1px 4px #000;transition:opacity .6s}
.hh3-hint.off{opacity:0}
.hh3-flash{position:absolute;inset:0;background:#c33;opacity:0;pointer-events:none;transition:opacity .5s}
.hh3-flash.on{opacity:.35;transition:none}
.hh3-fall{display:block;width:100%;height:100%;background:#0e0d22}
`;

// ---------- 2D fallback ----------
function playFallback(root, ctx, getBest) {
  const T = TEXT[ctx.lang] || TEXT.en;
  const canvas = document.createElement("canvas");
  canvas.id = "game";
  canvas.className = "hh3-fall";
  root.append(canvas);
  const hero = new Image();
  let run = null;
  let dead = false;
  let pendingBest = null;
  const boot = () => {
    if (dead) return;
    run = startRunner(canvas, { hero, accent: ctx.char.accent, best: pendingBest ?? getBest(), startText: T.fall, onOver: ctx.onOver });
  };
  hero.onload = boot;
  hero.onerror = boot;
  hero.src = ctx.char.stage;
  return {
    restart(b) { if (run) run.restart(b); else pendingBest = b; },
    destroy() { dead = true; run?.destroy(); canvas.remove(); },
  };
}

// ---------- 3D layer (untested outside a browser) ----------
function play3d(root, ctx, kit, getBest, setBest) {
  const THREE = kit.THREE;
  const T = TEXT[ctx.lang] || TEXT.en;
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const stone = mat(0x7d7f9c), moss = mat(0x4f6a5a), wood = mat(0x5b4636), leaf = mat(0x1f2b36), dark = mat(0x544c8a);
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
  const build = {
    tomb: () => { const g = new THREE.Group(); g.add(box(0.9, 0.5, 0.3, stone, 0, 0.25, 0), box(0.7, 0.2, 0.3, moss, 0, 0.6, 0)); return g; },
    cross: () => { const g = new THREE.Group(); g.add(box(0.16, 0.8, 0.16, wood, 0, 0.4, 0), box(0.55, 0.14, 0.16, wood, 0, 0.55, 0)); return g; },
    branch: () => {
      const g = new THREE.Group();
      g.add(box(1.5, 0.2, 0.2, wood, 0, 2.2, 0));
      for (const x of [-0.5, 0, 0.5]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 5), wood); c.rotation.z = Math.PI; c.position.set(x, 1.65, 0); g.add(c); }
      return g;
    },
  };
  const pools = {};
  for (const k of Object.keys(build)) {
    pools[k] = Array.from({ length: 14 }, () => { const g = build[k](); g.visible = false; kit.scene.add(g); return g; });
  }
  // ground, path, lane dashes, side scenery (all recycled by distance, nothing is created while playing)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 140), mat(0x3a3568));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -55;
  const path = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 3 + 0.4, 140), dark);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.01, -55);
  kit.scene.add(ground, path);
  const LEN = 64;
  const dashMat = mat(0x9a93d6);
  const dashes = Array.from({ length: 32 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.2), dashMat);
    m.rotation.x = -Math.PI / 2;
    kit.scene.add(m);
    return { m, d0: (i >> 1) * 4, x: (i & 1 ? 1 : -1) * LANE_W / 2 };
  });
  const scenery = Array.from({ length: 26 }, (_, i) => {
    const g = new THREE.Group();
    if (i % 2) { g.add(box(0.2, 0.8, 0.2, wood, 0, 0.4, 0)); const c = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 6), leaf); c.position.y = 1.9; g.add(c); }
    else { g.add(box(0.8, 0.7 + (i % 3) * 0.2, 0.25, stone, 0, 0.4, 0)); }
    kit.scene.add(g);
    return { g, d0: i * (LEN / 26), x: (i % 4 < 2 ? -1 : 1) * (3.8 + ((i * 37) % 10) * 0.35) };
  });
  kit.particles("fireflies", { count: 40, area: [12, 3, 30] });

  const ghost = kit.ghost(ctx.char.stage, 1.5);

  // HUD
  const hud = document.createElement("div");
  hud.className = "hh3-hud";
  hud.innerHTML = '<div class="hh3-score">0</div><div class="hh3-best"></div>';
  const hint = document.createElement("div");
  hint.className = "hh3-hint";
  hint.textContent = T.hint;
  const flash = document.createElement("div");
  flash.className = "hh3-flash";
  root.append(hud, hint, flash);
  const scoreEl = hud.firstChild, bestEl = hud.lastChild;
  const showBest = () => { bestEl.textContent = `${T.best} ${getBest() || 0}`; };

  let eng = createEngine();
  let shown = -1, shake = 0, reported = false, timer = 0, hintT = 0;
  showBest();

  function hide(el) { el.classList.add("off"); }
  function act(kind) {
    if (eng.over) return;
    if (kind === "L") eng.moveLane(-1); else if (kind === "R") eng.moveLane(1); else eng.hop();
    hintT = Math.max(hintT, 2.5);
  }

  kit.add((dt, t) => {
    if (!eng.over) eng.step(dt);
    const e = eng;
    if (e.over && !reported) {
      reported = true; shake = 0.5;
      flash.classList.add("on"); requestAnimationFrame(() => flash.classList.remove("on"));
      const s = e.score;
      timer = setTimeout(() => { setBest(Math.max(getBest() || 0, s)); showBest(); ctx.onOver(s); }, 700);
    }
    if (e.score !== shown) { shown = e.score; scoreEl.textContent = String(shown); }
    if (e.t > 0.3 && !hint.classList.contains("off")) { hintT += dt; if (hintT > 4) hide(hint); }
    // obstacles: hand out pooled meshes
    const used = { tomb: 0, cross: 0, branch: 0 };
    for (const k in pools) for (const g of pools[k]) g.visible = false;
    for (const o of e.obs) {
      const g = pools[o.kind][used[o.kind]++];
      if (!g) continue;
      g.visible = true;
      g.position.set(o.lane * LANE_W, 0, -(o.d - e.d));
    }
    for (const s of scenery) { s.g.position.set(s.x, 0, -(((s.d0 - e.d) % LEN + LEN) % LEN)); }
    for (const s of dashes) { s.m.position.set(s.x, 0.02, -((((s.d0 - e.d) % LEN) + LEN) % LEN)); }
    ghost.position.set(e.x, 0.75 + e.y + (e.over ? -0.2 : e.y === 0 ? Math.abs(Math.sin(t * 11)) * 0.1 : 0), 0);
    shake = Math.max(0, shake - dt);
    kit.camera.position.set(e.x * 0.45 + (Math.random() - 0.5) * shake * 0.4, 2.3 + (Math.random() - 0.5) * shake * 0.3, 5.2);
    kit.camera.lookAt(e.x * 0.2, 0.9, -7);
  });

  // input: swipe left/right = lane, swipe up or tap = hop; arrows / A D / W Space / Up
  let down = null;
  const onDown = (ev) => { down = { x: ev.clientX, y: ev.clientY, fired: false }; };
  const onMove = (ev) => {
    if (!down || down.fired) return;
    const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    down.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? "L" : "R"); else if (dy < 0) act("H");
  };
  const onUp = () => { if (down && !down.fired) act("H"); down = null; };
  const onKey = (ev) => {
    const k = ev.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") act("L");
    else if (k === "ArrowRight" || k === "d" || k === "D") act("R");
    else if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") act("H");
    else return;
    ev.preventDefault();
  };
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey);
  kit.start();

  return {
    restart(b) {
      clearTimeout(timer);
      if (b != null) setBest(b);
      eng = createEngine(); reported = false; shown = -1; shake = 0; hintT = 0;
      hint.classList.remove("off"); flash.classList.remove("on"); showBest();
    },
    destroy() {
      clearTimeout(timer);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      kit.destroy();
      hud.remove(); hint.remove(); flash.remove();
    },
  };
}

// ---------- entry ----------
export function start(root, ctx) {
  let style = document.getElementById("css-hop-hop-3d");
  const ownStyle = !style;
  if (ownStyle) {
    style = document.createElement("style");
    style.id = "css-hop-hop-3d";
    style.textContent = CSS;
    document.head.append(style);
  }
  root.classList.add("hh3");
  let best = ctx.best || 0;
  const getBest = () => best;
  const setBest = (b) => { best = b; };
  let dead = false;
  let impl = null;
  let queuedBest = null;

  if (ctx.reduceMotion) {
    impl = playFallback(root, ctx, getBest);
  } else {
    (async () => {
      let kit = null;
      try {
        const { canUse3D, createKit } = await import("../three/kit.js");
        if (!canUse3D()) throw new Error("no 3d");
        kit = await createKit(root, { accent: ctx.char.accent, fogColor: "#1a1838", fog: 0.028 });
        if (dead) { kit.destroy(); return; }
        impl = play3d(root, ctx, kit, getBest, setBest);
        if (queuedBest != null) impl.restart(queuedBest);
      } catch {
        try { kit?.destroy(); } catch { /* already gone */ }
        if (!dead) impl = playFallback(root, ctx, getBest);
      }
    })();
  }

  return {
    restart(b) { if (b != null) best = b; if (impl) impl.restart(b); else queuedBest = b ?? best; },
    destroy() {
      dead = true;
      impl?.destroy();
      impl = null;
      root.classList.remove("hh3");
      if (ownStyle) style.remove();
    },
  };
}
