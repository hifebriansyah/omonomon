// Lentera Terbang (Lantern Flight): a calm one-touch game. A paper lantern rises through the night; hold to drift right,
// let go to drift left. Collect wishes (+10), dodge branches and dark kites (3 flames), reach the moon (+50).
// The rules live in pure functions (createEngine / spawnRow / hit) shared by the 3D view and the 2D fallback.

export const FINISH = 110;   // world height of the moon
export const RISE = 1.5;     // units per second
export const XMAX = 2.8;
export const ROW = 4;
export const AHEAD = 14;
export const LANTERN_R = 0.35;
export const FLAMES = 3;
const STEER = 1.7;

// One row of the sky at height y: up to 2 wishes and at most one hazard (branches hug the edges so the middle stays open).
export function spawnRow(rng, y) {
  const out = [];
  const r = rng();
  if (r < 0.42) {
    const edge = rng() < 0.5 ? -1 : 1;
    out.push({ kind: "branch", x: edge * (2.1 + rng() * 0.7), y, r: 0.75, vx: 0 });
  } else if (r < 0.62) {
    out.push({ kind: "kite", x: (rng() * 2 - 1) * 2.3, y, r: 0.42, vx: (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.4) });
  }
  const n = rng() < 0.7 ? 1 : rng() < 0.3 ? 2 : 0;
  for (let i = 0; i < n; i++) out.push({ kind: "wish", x: (rng() * 2 - 1) * XMAX * 0.9, y: y + 1 + i * 1.3 + rng(), r: 0.32, vx: 0 });
  return out;
}

export const hit = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.r + b.r) ** 2;
export const scoreOf = (wishes, reachedMoon) => wishes * 10 + (reachedMoon ? 50 : 0);

export function createEngine({ rng = Math.random } = {}) {
  const s = { x: 0, vx: 0, y: 0, flames: FLAMES, score: 0, wishes: 0, time: 0, invuln: 0, done: null, items: [], nextRow: 5 };
  const me = { x: 0, y: 0, r: LANTERN_R };
  // Advances the world by dt seconds. Returns the events that happened: "wish", "hit", "moon", "out".
  function step(dt, hold) {
    const ev = [];
    if (s.done) return ev;
    s.time += dt;
    s.vx += ((hold ? STEER : -STEER) - s.vx) * Math.min(1, dt * 3);
    s.x += s.vx * dt;
    if (Math.abs(s.x) > XMAX) { s.x = Math.sign(s.x) * XMAX; s.vx = 0; }
    s.y += RISE * dt;
    s.invuln = Math.max(0, s.invuln - dt);
    while (s.nextRow <= s.y + AHEAD && s.nextRow < FINISH - 4) { s.items.push(...spawnRow(rng, s.nextRow)); s.nextRow += ROW; }
    me.x = s.x; me.y = s.y;
    let k = 0;
    for (const it of s.items) {
      if (it.vx) { it.x += it.vx * dt; if (Math.abs(it.x) > XMAX) it.vx = -it.vx; }
      let keep = it.y > s.y - 6;
      if (keep && hit(me, it)) {
        if (it.kind === "wish") { s.wishes++; s.score = scoreOf(s.wishes, false); ev.push("wish"); keep = false; }
        else if (s.invuln <= 0) { s.flames--; s.invuln = 1.6; ev.push("hit"); keep = false; }
      }
      if (keep) s.items[k++] = it;
    }
    s.items.length = k;
    if (s.flames <= 0) { s.done = "out"; ev.push("out"); }
    else if (s.y >= FINISH) { s.done = "moon"; s.score = scoreOf(s.wishes, true); ev.push("moon"); }
    return ev;
  }
  return { state: () => s, step };
}

const TEXT = {
  en: { score: "Wishes", flames: "Flames", tap: "Touch and hold to drift right, let go to drift left. Touch to begin.", moon: "The moon", end: "...", btn: "Hold to drift right" },
  id: { score: "Harapan", flames: "Api", tap: "Tahan untuk melayang ke kanan, lepas untuk ke kiri. Sentuh untuk mulai.", moon: "Bulan", end: "...", btn: "Tahan untuk ke kanan" },
};
const CSS = `.lt{position:relative;width:100%;height:100%;min-height:320px;background:#15142b;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
.lt .lt-view{position:absolute;inset:0}.lt canvas{display:block;width:100%;height:100%}
.lt-hud{position:absolute;top:8px;left:12px;right:12px;display:flex;justify-content:space-between;color:#ffe9b8;font:600 14px var(--comic,system-ui);pointer-events:none;text-shadow:0 1px 4px #000a}
.lt-hint{position:absolute;left:0;right:0;bottom:14%;text-align:center;color:#ffe9b8;font:14px var(--comic,system-ui);padding:0 24px;pointer-events:none;transition:opacity .6s}
.lt-hint.off{opacity:0}.lt-flame{display:inline-block;width:10px;height:14px;margin-left:4px;border-radius:50% 50% 50% 50%/65% 65% 35% 35%;background:#ffb347;box-shadow:0 0 8px #ffb347;transition:opacity .5s,transform .5s}
.lt-flame.out{opacity:.15;transform:scale(.6)}.lt-bar{position:absolute;right:6px;top:40px;bottom:40px;width:3px;border-radius:2px;background:#ffffff22;pointer-events:none}
.lt-bar i{position:absolute;left:-3px;width:9px;height:9px;border-radius:50%;background:var(--accent,#a47fd0);bottom:0}`;

export function start(root, ctx) {
  const L = TEXT[ctx.lang] || TEXT.en;
  const style = document.createElement("style");
  style.id = "css-lantern-flight";
  style.textContent = CSS;
  document.head.append(style);
  root.innerHTML = `<div class="lt"><div class="lt-view"></div><div class="lt-hud"><span>${L.score}: <b class="lt-sc">0</b></span><span class="lt-fl" aria-live="polite" aria-label="${L.flames}"></span></div><div class="lt-bar"><i></i></div><div class="lt-hint">${L.tap}</div></div>`;
  const box = root.querySelector(".lt");
  const viewEl = root.querySelector(".lt-view");
  const scEl = root.querySelector(".lt-sc");
  const flEl = root.querySelector(".lt-fl");
  const hintEl = root.querySelector(".lt-hint");
  const barDot = root.querySelector(".lt-bar i");
  flEl.innerHTML = '<span class="lt-flame"></span>'.repeat(FLAMES);

  let eng, hold = false, running = false, over = false, destroyed = false, view = null, flicker = 0, raf = 0, last = 0, timer = 0, shown = "";

  function newRun() {
    eng = createEngine();
    running = false; over = false; hold = false; flicker = 0;
    clearTimeout(timer);
    hintEl.classList.remove("off");
    paint();
  }
  function paint() {
    const s = eng.state();
    const sig = s.score + ":" + s.flames;
    if (sig !== shown) {
      shown = sig;
      scEl.textContent = s.score;
      flEl.querySelectorAll(".lt-flame").forEach((f, i) => f.classList.toggle("out", i >= s.flames));
    }
    barDot.style.bottom = `calc(${Math.min(1, s.y / FINISH) * 100}% - 4px)`;
  }
  function tick(dt) {
    if (!running || over) return;
    const ev = eng.step(dt, hold);
    if (ev.includes("hit") && !ctx.reduceMotion) flicker = 1;
    flicker = Math.max(0, flicker - dt);
    paint();
    if (eng.state().done) {
      over = true;
      timer = setTimeout(() => { if (!destroyed) ctx.onOver(eng.state().score); }, 1400);
    }
  }
  const press = (v) => { hold = v; if (v && !running && !over) { running = true; hintEl.classList.add("off"); } };
  const down = (e) => { e.preventDefault(); press(true); };
  const up = () => press(false);
  const keyOk = (e) => e.code === "Space" || e.code === "ArrowRight";
  const kd = (e) => { if (keyOk(e)) { e.preventDefault(); press(true); } };
  const ku = (e) => { if (keyOk(e)) press(false); };
  box.addEventListener("pointerdown", down);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
  addEventListener("keydown", kd);
  addEventListener("keyup", ku);
  addEventListener("blur", up);

  async function init() {
    newRun();
    let kit = null;
    try {
      const mod = await import("../three/kit.js");
      if (destroyed) return;
      if (!ctx.reduceMotion && mod.canUse3D()) kit = await mod.createKit(viewEl, { accent: ctx.char?.accent, fogColor: "#15142b", fog: 0.045 });
    } catch { kit = null; }
    if (destroyed) { kit?.destroy(); return; }
    try { view = kit ? view3D(kit, ctx, () => eng, () => flicker, tick) : view2D(viewEl, () => eng, () => flicker, tick); }
    catch { kit?.destroy(); view = view2D(viewEl, () => eng, () => flicker, tick, () => {}); kit = null; }
    if (!kit) { last = performance.now(); raf = requestAnimationFrame(loop2d); }
  }
  function loop2d(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(loop2d);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tick(dt);
    view.draw();
  }
  init();

  return {
    restart() { if (!destroyed) newRun(); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf); clearTimeout(timer);
      box.removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("blur", up);
      view?.destroy();
      style.remove();
      root.innerHTML = "";
    },
  };
}

// ---- 3D view (kit): lantern, wishes and hazards come from small pools, positions are set each frame, nothing is allocated ----
function view3D(kit, ctx, getEng, getFlicker, tick) {
  const { THREE, scene, camera, lights } = kit;
  const geos = {
    wish: new THREE.OctahedronGeometry(0.28), branch: new THREE.ConeGeometry(0.22, 1.9, 5), kite: new THREE.OctahedronGeometry(0.5),
    body: new THREE.CylinderGeometry(0.3, 0.2, 0.55, 8, 1, true), cap: new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), moon: new THREE.SphereGeometry(3, 16, 12),
  };
  const mats = {
    wish: new THREE.MeshBasicMaterial({ color: 0xffe08a }), branch: new THREE.MeshLambertMaterial({ color: 0x3a2a24 }), kite: new THREE.MeshLambertMaterial({ color: 0x241f3a }),
    body: new THREE.MeshBasicMaterial({ color: 0xffb25e, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), cap: new THREE.MeshBasicMaterial({ color: 0x6b3b22 }), moon: new THREE.MeshBasicMaterial({ color: 0xf4efd6, fog: false }),
  };
  for (const g of Object.values(geos)) kit.track(g);
  for (const m of Object.values(mats)) kit.track(m);
  const lantern = new THREE.Group();
  lantern.add(new THREE.Mesh(geos.body, mats.body));
  const base = new THREE.Mesh(geos.cap, mats.cap); base.position.y = -0.3; lantern.add(base);
  scene.add(lantern);
  const moon = new THREE.Mesh(geos.moon, mats.moon);
  moon.position.set(2, FINISH + 7, -9);
  scene.add(moon);
  const url = ctx.char?.head || ctx.char?.stage;
  const ghost = url ? kit.ghost(url, 0.75) : null;
  const pool = {};
  for (const k of ["wish", "branch", "kite"]) {
    pool[k] = Array.from({ length: k === "wish" ? 16 : 8 }, () => { const m = new THREE.Mesh(geos[k], mats[k]); m.visible = false; scene.add(m); return m; });
  }
  const fire = kit.particles("fireflies", { count: 50, area: [9, 12, 6] });
  const dust = kit.particles("dust", { count: 60, area: [9, 12, 6] });
  kit.lights.moon.intensity = 0.8;
  kit.add((dt, t) => {
    tick(dt);
    const s = getEng().state();
    lantern.position.set(s.x, s.y, 0);
    lantern.rotation.z = -s.vx * 0.12;
    if (ghost) ghost.position.set(s.x, s.y + 0.38, -0.12);
    camera.position.set(s.x * 0.3, s.y + 1.6, 6.5);
    camera.lookAt(s.x * 0.3, s.y + 2.6, 0);
    fire.position.y = dust.position.y = s.y - 3;
    const f = getFlicker();
    lights.lantern.position.set(s.x, s.y + 0.4, 1.2);
    lights.lantern.intensity = f > 0 ? 1.6 * (0.45 + 0.4 * Math.abs(Math.sin(t * 22))) : 1.6 + Math.sin(t * 3) * 0.12;
    const used = { wish: 0, branch: 0, kite: 0 };
    for (const it of s.items) {
      const m = pool[it.kind][used[it.kind]++];
      if (!m) continue;
      m.visible = true;
      m.position.set(it.x, it.y, 0);
      if (it.kind === "wish") m.rotation.y = t * 1.5;
      else if (it.kind === "branch") m.rotation.z = (it.x < 0 ? -1 : 1) * 1.25;
      else m.rotation.z = Math.sin(t * 2 + it.y) * 0.3;
    }
    for (const k in pool) for (let i = used[k]; i < pool[k].length; i++) pool[k][i].visible = false;
  });
  kit.start();
  return { draw() {}, destroy() { kit.destroy(); } };
}

// ---- 2D fallback: same engine, simple canvas shapes ----
function view2D(el, getEng, getFlicker, tick) {
  const cv = document.createElement("canvas");
  el.append(cv);
  const g = cv.getContext("2d");
  const stars = Array.from({ length: 40 }, (_, i) => [(i * 97) % 360, (i * 211) % 540, i % 3 ? 1 : 1.8]);
  const resize = () => { const d = Math.min(devicePixelRatio || 1, 2); cv.width = Math.max(1, el.clientWidth) * d; cv.height = Math.max(1, el.clientHeight) * d; };
  const ro = new ResizeObserver(resize); ro.observe(el); resize();
  return {
    draw() {
      const s = getEng().state(), W = cv.width, H = cv.height, u = Math.min(W / 7, H / 11), ox = W / 2, oy = H * 0.68;
      const X = (x) => ox + x * u, Y = (y) => oy - (y - s.y) * u * 0.9;
      g.fillStyle = "#15142b"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#dfe6ff";
      for (const [x, y, r] of stars) { g.globalAlpha = 0.5; g.beginPath(); g.arc((x / 360) * W, (((y - s.y * 6) % 540 + 540) % 540) / 540 * H, r * u / 50, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      const my = Y(FINISH + 5);
      if (my > -u * 4) { g.fillStyle = "#f4efd6"; g.beginPath(); g.arc(X(2), my, u * 2, 0, 7); g.fill(); }
      for (const it of s.items) {
        const x = X(it.x), y = Y(it.y);
        if (it.kind === "wish") { g.fillStyle = "#ffe08a"; g.beginPath(); for (let i = 0; i < 10; i++) { const r = (i % 2 ? 0.14 : 0.32) * u, a = i * Math.PI / 5; g.lineTo(x + Math.sin(a) * r, y - Math.cos(a) * r); } g.fill(); }
        else if (it.kind === "branch") { g.strokeStyle = "#4a352c"; g.lineWidth = u * 0.22; g.lineCap = "round"; g.beginPath(); g.moveTo(X(Math.sign(it.x) * 3.6), y - u * 0.2); g.lineTo(x - Math.sign(it.x) * u * 0.6, y + u * 0.1); g.stroke(); }
        else { g.fillStyle = "#2c2748"; g.beginPath(); g.moveTo(x, y - u * 0.5); g.lineTo(x + u * 0.38, y); g.lineTo(x, y + u * 0.5); g.lineTo(x - u * 0.38, y); g.fill(); }
      }
      const lx = X(s.x), ly = Y(s.y), f = getFlicker();
      g.globalAlpha = f > 0 ? 0.55 : 1;
      const grd = g.createRadialGradient(lx, ly, 0, lx, ly, u * 1.6);
      grd.addColorStop(0, "#ffb25e66"); grd.addColorStop(1, "#ffb25e00");
      g.fillStyle = grd; g.fillRect(lx - u * 2, ly - u * 2, u * 4, u * 4);
      g.fillStyle = "#ffb25e"; g.beginPath(); g.roundRect(lx - u * 0.3, ly - u * 0.3, u * 0.6, u * 0.6, u * 0.12); g.fill();
      g.fillStyle = "#6b3b22"; g.fillRect(lx - u * 0.22, ly + u * 0.3, u * 0.44, u * 0.07);
      g.fillStyle = "#e8e0ff"; g.beginPath(); g.arc(lx, ly - u * 0.42, u * 0.16, 0, 7); g.fill();
      g.globalAlpha = 1;
    },
    destroy() { ro.disconnect(); cv.remove(); },
  };
}
