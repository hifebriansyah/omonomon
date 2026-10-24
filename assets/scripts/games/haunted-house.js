// Rumah Hantu: a short walk through four rooms, one ghost and one tiny puzzle each.
// Room 1 (Pocomon) find 5 hidden glows, room 2 (Ngesomon) light 4 lanterns in the told order, room 3 (Sundemon) follow 3 petals
// to the door, room 4 (Kuntimon) open the 3 whispering pieces of furniture. Score = 25 per room + a time bonus (finish in
// 60 s = +50, 180 s or more = +0; only for a finished run). Gives up early: 25 per solved room, no bonus.
// Everything above "THE GAME" is pure (no DOM, no three), so tests/haunted-house.test.mjs runs it alone.
// The 3D layer uses the shared kit (assets/scripts/three/kit.js); without WebGL a flat 2D version of the same puzzles plays.

export const HALF = 5;               // rooms are 10 x 10 units, x and z in [-5, 5]
export const WALL_H = 3.2;
export const PLAYER_R = 0.3;
export const START = { x: 0, z: 4 };
export const DOOR = { x: 0, z: -4.3, r: 1.1 };
export const ROOM_CHARS = ["1", "2", "3", "4"];
export const PER_ROOM = 25;
export const BONUS_FAST = 60, BONUS_SLOW = 180, BONUS_MAX = 50;
export const COUNTS = { items: 5, lanterns: 4, petals: 3, secrets: 3 };
export const KINDS = ["items", "lanterns", "petals", "secrets"];
export const LANTERN_COLORS = ["red", "blue", "gold", "green"];
export const FURNITURE = { // [width, height, depth] and whether it whispers
  wardrobe: { size: [1.2, 2.2, 0.7], secret: true }, shelf: { size: [1.6, 2.0, 0.5], secret: true }, trunk: { size: [1.1, 0.7, 0.7], secret: true },
  mirror: { size: [0.9, 1.9, 0.2], secret: false }, table: { size: [1.4, 0.9, 1.0], secret: false },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const box = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
export const WALLS = [box(-5.4, -5, -5.4, 5.4), box(5, 5.4, -5.4, 5.4), box(-5.4, 5.4, -5.4, -5), box(-5.4, 5.4, 5, 5.4)];
// fixed furniture that blocks the way (kept away from the corners where the ghosts stand)
export const PROPS = [
  [box(-3.6, -2.2, 0, 1.4), box(2.2, 3.6, 1.8, 3.2)],
  [box(-0.8, 0.8, -0.6, 0.8)],
  [box(-2.5, -1.7, -1.2, -0.4), box(1.7, 2.5, 1.2, 2)],
  [],
];
export const GHOST_AT = [{ x: -3.6, z: -3.4 }, { x: 3.6, z: -3.4 }, { x: -3.6, z: -3.4 }, { x: 3.6, z: -3.4 }];

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- collision: circle against axis-aligned boxes -------------------------------------------------------------------------
export function pushOut(x, z, r, b) {
  const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
  let dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) { const d = Math.sqrt(d2); return { x: cx + (dx / d) * r, z: cz + (dz / d) * r }; }
  // centre is inside the box: leave by the nearest side
  const opts = [[x - b.minX, -1, 0], [b.maxX - x, 1, 0], [z - b.minZ, 0, -1], [b.maxZ - z, 0, 1]].sort((p, q) => p[0] - q[0])[0];
  return { x: opts[1] ? (opts[1] < 0 ? b.minX - r : b.maxX + r) : x, z: opts[2] ? (opts[2] < 0 ? b.minZ - r : b.maxZ + r) : z };
}
export function resolveCircle(x, z, r, boxes) {
  let p = { x, z };
  for (let pass = 0; pass < 3; pass++) {
    let hit = false;
    for (const b of boxes) { const q = pushOut(p.x, p.z, r, b); if (q) { p = q; hit = true; } }
    if (!hit) break;
  }
  return p;
}
export const movePlayer = (pos, dx, dz, boxes, r = PLAYER_R) => resolveCircle(pos.x + dx, pos.z + dz, r, boxes);
export const circleHitsBox = (x, z, r, b) => pushOut(x, z, r, b) !== null;

// ---- layouts: where things go ---------------------------------------------------------------------------------------------
// Random points inside the room, clear of boxes, of `avoid` points and of each other.
export function placePoints(n, rng, { boxes = [], avoid = [], margin = 0.6, gap = 1.6, limit = 4.2 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    let got = null;
    for (let t = 0; t < 300 && !got; t++) {
      const g = t > 200 ? gap * 0.5 : gap; // relax if the room is crowded
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

export function makeRoom(index, rng = Math.random) {
  const kind = KINDS[index];
  const props = PROPS[index];
  const ghost = GHOST_AT[index];
  const avoid = [{ ...START, r: 1.6 }, { ...ghost, r: 1.4 }, { x: DOOR.x, z: DOOR.z, r: 1.4 }];
  const base = { index, kind, char: ROOM_CHARS[index], props, ghost, door: { ...DOOR }, start: { ...START }, order: null };
  let items = [];
  if (kind === "items") {
    items = placePoints(COUNTS.items, rng, { boxes: props, avoid, gap: 1.8 }).map((p, i) => ({ id: `i${i}`, ...p }));
  } else if (kind === "lanterns") {
    items = placePoints(COUNTS.lanterns, rng, { boxes: props, avoid, gap: 2.4, margin: 0.7 }).map((p, i) => ({ id: `l${i}`, color: LANTERN_COLORS[i], ...p }));
    base.order = shuffle(items.map((it) => it.id), rng);
  } else if (kind === "petals") {
    // a loose path from the start towards the door: one petal per band of the room
    items = [1.9, -0.3, -2.4].map((z, i) => {
      let x = 0;
      for (let t = 0; t < 40; t++) { x = (rng() * 2 - 1) * 2.6; if (!props.some((b) => circleHitsBox(x, z, 0.7, b))) break; x = 0; }
      return { id: `p${i}`, x, z };
    });
  } else {
    const names = Object.keys(FURNITURE);
    const spots = placePoints(names.length, rng, { avoid, gap: 2.5, margin: 1.0, limit: 3.9 });
    items = shuffle(names, rng).map((name, i) => ({ id: name, name, secret: FURNITURE[name].secret, ...spots[i] }));
  }
  const bodies = kind === "secrets" ? items.map((it) => { const [w, , d] = FURNITURE[it.name].size; return box(it.x - w / 2, it.x + w / 2, it.z - d / 2, it.z + d / 2); }) : [];
  return { ...base, items, boxes: [...WALLS, ...props, ...bodies] };
}

// ---- puzzle state machines ------------------------------------------------------------------------------------------------
// touch(id) -> "ok" | "wrong" | "repeat" | "empty" | "ignore"
export function createPuzzle(layout) {
  const ids = layout.items.map((it) => it.id);
  const found = new Set();
  let step = 0; // lanterns: next position in the order; petals: next petal
  const target = layout.kind === "secrets" ? layout.items.filter((it) => it.secret).map((it) => it.id) : ids;
  const total = layout.kind === "lanterns" ? layout.order.length : target.length;
  const api = {
    kind: layout.kind, total,
    count: () => (layout.kind === "lanterns" || layout.kind === "petals" ? step : found.size),
    done: () => api.count() >= total,
    found: (id) => found.has(id),
    // is the object shown right now? (hidden glows vanish once taken; only the next petal floats in view)
    visible: (id) => (layout.kind === "items" ? !found.has(id) : layout.kind === "petals" ? !api.done() && id === ids[step] : true),
    touch(id) {
      if (api.done() || !ids.includes(id)) return "ignore";
      if (layout.kind === "lanterns") {
        if (found.has(id)) return "repeat";
        if (id === layout.order[step]) { found.add(id); step++; return "ok"; }
        found.clear(); step = 0; return "wrong";
      }
      if (layout.kind === "petals") {
        if (id === ids[step]) { found.add(id); step++; return "ok"; }
        return found.has(id) ? "repeat" : "ignore";
      }
      if (!target.includes(id)) return "empty";
      if (found.has(id)) return "repeat";
      found.add(id); return "ok";
    },
  };
  return api;
}

export function scoreOf(rooms, seconds) {
  const n = clamp(Math.floor(rooms), 0, 4);
  const bonus = n >= 4 ? Math.round(BONUS_MAX * clamp((BONUS_SLOW - seconds) / (BONUS_SLOW - BONUS_FAST), 0, 1)) : 0;
  return n * PER_ROOM + bonus;
}

export function createRun(rng = Math.random) {
  const layouts = [0, 1, 2, 3].map((i) => makeRoom(i, rng));
  const solved = [false, false, false, false];
  let room = 0, t = 0, over = false, puzzle = createPuzzle(layouts[0]);
  const run = {
    layouts,
    get room() { return room; }, get puzzle() { return puzzle; }, get layout() { return layouts[room]; },
    get over() { return over; }, get time() { return t; }, get solvedCount() { return solved.filter(Boolean).length; },
    tick(dt) { if (!over) t += Math.max(0, dt); },
    touch(id) {
      if (over || solved[room]) return { result: "ignore" };
      const result = puzzle.touch(id);
      if (!puzzle.done()) return { result };
      solved[room] = true;
      if (room === 3) over = true;
      return { result, roomDone: true, runDone: room === 3 };
    },
    canExit: () => !over && solved[room] && room < 3,
    next() { if (!run.canExit()) return false; room++; puzzle = createPuzzle(layouts[room]); return true; },
    leave() { over = true; },
    score: () => scoreOf(run.solvedCount, t),
    lastChar: () => ROOM_CHARS[room],
  };
  return run;
}

// ================================================ THE GAME (browser only) ================================================
const TEXT = {
  en: {
    leave: "Leave", time: "Time", doorOpen: "The door is open. Go through it.", walk: "Walk close to the glow.", far: "Too far. Walk closer.",
    rooms: ["Pocomon's room", "Ngesomon's room", "Sundemon's room", "Kuntimon's room"],
    colors: { red: "red", blue: "blue", gold: "gold", green: "green" },
    names: { wardrobe: "wardrobe", shelf: "bookshelf", trunk: "trunk", mirror: "mirror", table: "table" },
    hint: ["Hidden glows found", "Lanterns lit", "Petals followed", "Secrets heard"],
    intro: ["Five things are hidden in here. Find them. Don't make it weird.", "Quick, the lanterns. Light them in this order: {o}. I have rounds.",
      "Follow the petals. No hurry... the door will wait.", "Psst. Three things in here are whispering: the wardrobe, the bookshelf, the trunk. Go listen!"],
    done: ["Five. Fine. Go through the door.", "Good. Warm in here now. Next door, go.", "You followed all the way. Thank you.", "Ooh, secrets! You didn't hear them from me."],
    wrong: "Wrong order. They all went out. Start over, I'll wait. Briefly.", empty: "Nothing. Just dust. Try another!",
    ctl: "Move: WASD / arrows. Look: drag. Act: Space or tap.", ctlTouch: "Left thumb moves, drag the right side to look, tap to act.",
  },
  id: {
    leave: "Pergi", time: "Waktu", doorOpen: "Pintunya terbuka. Lewat sana.", walk: "Dekati cahayanya.", far: "Kejauhan. Dekati dulu.",
    rooms: ["Kamar Pocomon", "Kamar Ngesomon", "Kamar Sundemon", "Kamar Kuntimon"],
    colors: { red: "merah", blue: "biru", gold: "emas", green: "hijau" },
    names: { wardrobe: "lemari", shelf: "rak buku", trunk: "peti", mirror: "cermin", table: "meja" },
    hint: ["Cahaya tersembunyi ketemu", "Lentera menyala", "Kelopak diikuti", "Rahasia terdengar"],
    intro: ["Ada lima benda tersembunyi di sini. Cari. Jangan dibikin aneh.", "Cepat, lenteranya. Nyalakan urutan ini: {o}. Aku masih harus keliling.",
      "Ikuti kelopaknya. Nggak usah buru-buru... pintunya bakal menunggu.", "Psst. Ada tiga benda di sini yang berbisik: lemari, rak buku, peti. Dengerin sana!"],
    done: ["Lima. Oke. Lewat pintu sana.", "Bagus. Hangat sekarang. Pintu berikutnya, sana.", "Kamu ikuti sampai akhir. Terima kasih.", "Wah, rahasia! Kamu nggak dengar dari aku ya."],
    wrong: "Urutannya salah, padam semua. Ulang ya, aku tunggu. Sebentar.", empty: "Kosong. Cuma debu. Coba yang lain!",
    ctl: "Jalan: WASD / panah. Lihat: geser. Aksi: Spasi atau ketuk.", ctlTouch: "Jempol kiri untuk jalan, geser sisi kanan untuk melihat, ketuk untuk beraksi.",
  },
};
const LCOL = { red: 0xff5a5a, blue: 0x5aa0ff, gold: 0xffd24a, green: 0x5aff9a };
const CSS = `
.rh{position:relative;width:100%;height:min(72vh,560px);min-height:360px;overflow:hidden;background:#0e0c1c;color:#f1ecff;font-family:var(--comic,inherit);user-select:none;-webkit-user-select:none}
.rh-stage{position:absolute;inset:0}.rh-pad{position:absolute;inset:0;touch-action:none;z-index:2}
.rh-top{position:absolute;top:0;left:0;right:0;z-index:4;display:flex;gap:8px;align-items:center;padding:8px 10px;background:linear-gradient(#0b0918e6,#0b091800);font-size:.85rem}
.rh-top b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rh button{font:inherit;color:inherit;cursor:pointer}
.rh-leave{border:1px solid #fff4;background:#0008;border-radius:999px;padding:6px 12px;min-height:36px}
.rh-bot{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:10px;pointer-events:none;background:linear-gradient(#0b091800,#0b0918ee)}
.rh-say{background:#1b1730ee;border:1px solid var(--accent,#a47fd0);border-radius:12px;padding:8px 12px;font-size:.92rem;line-height:1.35;margin-bottom:6px}
.rh-hint,.rh-ctl{font-size:.8rem;opacity:.85}.rh-ctl{opacity:.55;margin-top:2px}
.rh-stick{position:absolute;z-index:3;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;border:2px solid #fff5;pointer-events:none;display:none}
.rh-stick i{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border-radius:50%;background:#fff6}
.rh2{position:absolute;inset:44px 8px 120px;border:2px solid #fff3;border-radius:10px;background:radial-gradient(circle at 50% 70%,#2b2447,#120f22)}
.rh2 button,.rh2 .rh-prop,.rh2 img{position:absolute;transform:translate(-50%,-50%)}
.rh-prop{background:#3b3358;border-radius:6px;transform:none!important}
.rh2 img{width:22%;max-width:110px;pointer-events:none;opacity:.95}
.rh-o{min-width:44px;min-height:44px;border-radius:50%;border:0;background:radial-gradient(#ffe08a,#ffe08a00 70%);opacity:.5}
.rh-o:hover,.rh-o:focus-visible{opacity:1}
.rh-lan{min-width:46px;min-height:56px;border-radius:10px 10px 6px 6px;border:2px solid #fff6;background:var(--c);opacity:.45}
.rh-lan.on{opacity:1;box-shadow:0 0 18px var(--c)}
.rh-pet{min-width:48px;min-height:48px;border-radius:50% 0;border:0;background:#ffb8d8;box-shadow:0 0 16px #ffb8d8}
.rh-fur{min-width:62px;min-height:62px;border-radius:8px;border:2px solid #fff4;background:#4a3d6a;font-size:.72rem;padding:2px}
.rh-fur.whisper{box-shadow:0 0 14px #c9a8ff}.rh-fur.on{border-color:#8f8}
.rh-door{min-width:54px;min-height:70px;border-radius:8px;border:2px solid #fff5;background:#4a2430;font-size:.7rem;opacity:.6}
.rh-door.open{background:#ffd98a;color:#201;opacity:1;box-shadow:0 0 20px #ffd98a}
`;

export function start(root, ctx) {
  const L = TEXT[ctx.lang === "id" ? "id" : "en"];
  const style = document.createElement("style");
  style.id = "css-haunted-house";
  style.textContent = CSS;
  document.head.append(style);
  const touchy = matchMedia("(pointer: coarse)").matches;
  const wrap = document.createElement("div");
  wrap.className = "rh";
  wrap.innerHTML = `<div class="rh-stage"></div><div class="rh-top"><b></b><span class="rh-time"></span><button type="button" class="rh-leave"></button></div>
    <div class="rh-bot"><div class="rh-say" aria-live="polite"></div><div class="rh-hint"></div><div class="rh-ctl"></div></div>`;
  root.replaceChildren(wrap);
  const $ = (s) => wrap.querySelector(s);
  const stage = $(".rh-stage"), sayEl = $(".rh-say"), hintEl = $(".rh-hint"), timeEl = $(".rh-time");
  $(".rh-leave").textContent = L.leave;
  $(".rh-leave").addEventListener("click", () => finish(true));

  let run = createRun(), view = null, ended = false, destroyed = false, gen = 0, timer = 0, lastSec = -1;
  const timeouts = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };
  const keys = new Set();
  const gname = () => ctx.chars?.[run.room]?.name || "";

  const orderText = () => run.layout.order.map((id) => L.colors[run.layout.items.find((it) => it.id === id).color]).join(" > ");
  const say = (txt) => { sayEl.textContent = `${gname()}: ${txt}`; };
  const hud = () => {
    $(".rh-top b").textContent = L.rooms[run.room];
    const p = run.puzzle;
    let h = `${L.hint[run.room]}: ${p.count()}/${p.total}`;
    if (run.layout.kind === "lanterns") h += `  (${orderText()})`;
    hintEl.textContent = run.canExit() ? L.doorOpen : h;
  };
  const tickClock = () => {
    const s = Math.floor(run.time);
    if (s !== lastSec) { lastSec = s; timeEl.textContent = `${L.time} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
  };
  const enterRoom = () => {
    const intro = L.intro[run.room].replace("{o}", run.layout.kind === "lanterns" ? orderText() : "");
    say(intro); hud(); view?.setRoom(run.layout, run.puzzle);
  };

  function act(id) {
    if (ended) return;
    const { result, roomDone, runDone } = run.touch(id);
    if (result === "ignore") return;
    if (result === "wrong") say(L.wrong);
    else if (result === "empty") say(L.empty);
    if (roomDone) say(L.done[run.room]);
    hud(); view?.refresh();
    if (runDone) later(() => finish(false), 1100);
  }
  function advance() { if (run.next()) { enterRoom(); } }
  function finish(gaveUp) {
    if (ended) return;
    ended = true;
    if (gaveUp) run.leave();
    ctx.onOver(run.score(), { char: run.lastChar() });
  }

  // ---------------------------------------------------------- 2D version (also the fallback)
  function make2D() {
    const el = document.createElement("div");
    el.className = "rh2";
    stage.replaceChildren(el);
    const pct = (v) => `${((v + HALF) / (2 * HALF)) * 100}%`;
    let last = performance.now();
    const clock = setInterval(() => { const n = performance.now(); if (!document.hidden && !ended) { run.tick(Math.min(0.5, (n - last) / 1000)); tickClock(); } last = n; }, 250);
    const v = {
      setRoom() { v.refresh(); },
      refresh() {
        const lay = run.layout, p = run.puzzle;
        el.replaceChildren();
        const pos = (n, x, z) => { n.style.left = pct(x); n.style.top = pct(z); return n; };
        for (const b of lay.props) {
          const d = document.createElement("div");
          d.className = "rh-prop"; d.style.cssText = `left:${pct(b.minX)};top:${pct(b.minZ)};width:${((b.maxX - b.minX) / 10) * 100}%;height:${((b.maxZ - b.minZ) / 10) * 100}%`;
          el.append(d);
        }
        const g = document.createElement("img");
        g.src = ctx.chars?.[run.room]?.stage || ""; g.alt = gname(); el.append(pos(g, lay.ghost.x, lay.ghost.z + 0.6));
        for (const it of lay.items) {
          if (!p.visible(it.id)) continue;
          const b = document.createElement("button");
          b.type = "button";
          if (lay.kind === "items") { b.className = "rh-o"; b.setAttribute("aria-label", L.walk); }
          else if (lay.kind === "lanterns") { b.className = `rh-lan${p.found(it.id) ? " on" : ""}`; b.style.setProperty("--c", `#${LCOL[it.color].toString(16)}`); b.setAttribute("aria-label", L.colors[it.color]); }
          else if (lay.kind === "petals") { b.className = "rh-pet"; b.setAttribute("aria-label", L.hint[2]); }
          else { b.className = `rh-fur${it.secret ? " whisper" : ""}${p.found(it.id) ? " on" : ""}`; b.textContent = L.names[it.name]; }
          b.addEventListener("click", () => act(it.id));
          el.append(pos(b, it.x, it.z));
        }
        const d = document.createElement("button");
        d.type = "button"; d.className = `rh-door${run.canExit() ? " open" : ""}`; d.textContent = "▮"; d.disabled = !run.canExit();
        d.setAttribute("aria-label", L.doorOpen);
        d.addEventListener("click", advance);
        el.append(pos(d, lay.door.x, lay.door.z - 0.4));
      },
      dispose() { clearInterval(clock); el.remove(); },
    };
    return v;
  }

  // ---------------------------------------------------------- 3D version
  async function make3D(kitMod) {
    const kit = await kitMod.createKit(stage, { accent: ctx.char?.accent, fogColor: "#15142b", fog: 0.09 });
    const T = kit.THREE, cam = kit.camera, lantern = kit.lights.lantern;
    cam.rotation.order = "YXZ";
    const BOX = new T.BoxGeometry(1, 1, 1), SPHERE = new T.SphereGeometry(0.5, 10, 8);
    const mats = {
      wall: new T.MeshLambertMaterial({ color: 0x6a5a88 }), floor: new T.MeshLambertMaterial({ color: 0x4a3f6e }), prop: new T.MeshLambertMaterial({ color: 0x7a6aa0 }),
      item: new T.MeshBasicMaterial({ color: 0xffe08a }), petal: new T.MeshBasicMaterial({ color: 0xffb8d8 }), orb: new T.MeshBasicMaterial({ color: 0xc9a8ff }),
      locked: new T.MeshLambertMaterial({ color: 0x5a2535 }), open: new T.MeshBasicMaterial({ color: 0xffd98a }),
      fur: new T.MeshLambertMaterial({ color: 0x5b4a80 }), furOn: new T.MeshLambertMaterial({ color: 0x4a8a5a }),
      dim: {}, lit: {},
    };
    for (const c of LANTERN_COLORS) { mats.dim[c] = new T.MeshLambertMaterial({ color: LCOL[c], emissive: LCOL[c], emissiveIntensity: 0.08 }); mats.lit[c] = new T.MeshBasicMaterial({ color: LCOL[c] }); }
    kit.track({ dispose() { BOX.dispose(); SPHERE.dispose(); [mats.wall, mats.floor, mats.prop, mats.item, mats.petal, mats.orb, mats.locked, mats.open, mats.fur, mats.furOn, ...Object.values(mats.dim), ...Object.values(mats.lit)].forEach((m) => m.dispose()); } });
    const dust = kit.particles("dust", { count: 60, area: [10, 3, 10] });
    dust.position.z = 2;
    const group = new T.Group();
    kit.scene.add(group);
    const pool = [], used = [];
    const mesh = (geo, mat, sx, sy, sz, x, y, z) => {
      const m = pool.pop() || new T.Mesh(geo);
      m.geometry = geo; m.material = mat; m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(0, 0, 0); m.visible = true; m.userData = {};
      group.add(m); used.push(m); return m;
    };
    const boxMesh = (b, h, mat) => mesh(BOX, mat, b.maxX - b.minX, h, b.maxZ - b.minZ, (b.minX + b.maxX) / 2, h / 2, (b.minZ + b.maxZ) / 2);
    const ghosts = [];
    let recs = [], lay = null, pz = null, doorMesh = null;
    const player = { x: START.x, z: START.z, yaw: 0, pitch: 0 };
    const stick = { x: 0, y: 0 };

    const v = {
      setRoom(layout, puzzle) {
        lay = layout; pz = puzzle;
        for (const m of used) group.remove(m);
        pool.push(...used); used.length = 0; recs = [];
        mats.wall.color.setHex([0x6a5a88, 0x4e7a7c, 0x7a6a92, 0x8a5e6c][layout.index]);
        mesh(BOX, mats.floor, 10.8, 0.2, 10.8, 0, -0.1, 0);
        mesh(BOX, mats.wall, 10.8, 0.2, 10.8, 0, WALL_H + 0.1, 0);
        for (const w of WALLS) boxMesh(w, WALL_H, mats.wall);
        for (const b of layout.props) boxMesh(b, 1.1, mats.prop);
        doorMesh = mesh(BOX, mats.locked, 2, 2.4, 0.12, layout.door.x, 1.2, -4.94);
        for (const it of layout.items) {
          let m, aux = null;
          if (layout.kind === "items") m = mesh(BOX, mats.item, 0.26, 0.26, 0.26, it.x, 0.4 + (it.x * 7 % 3 + 3) % 3 * 0.12, it.z);
          else if (layout.kind === "lanterns") m = mesh(BOX, mats.dim[it.color], 0.4, 0.55, 0.4, it.x, 1, it.z);
          else if (layout.kind === "petals") m = mesh(SPHERE, mats.petal, 0.4, 0.1, 0.26, it.x, 1.2, it.z);
          else {
            const [w, h, d] = FURNITURE[it.name].size;
            m = mesh(BOX, mats.fur, w, h, d, it.x, h / 2, it.z);
            if (it.secret) aux = mesh(SPHERE, mats.orb, 0.22, 0.22, 0.22, it.x, h + 0.35, it.z);
          }
          m.userData.id = it.id;
          recs.push({ it, m, aux });
        }
        const g = (ghosts[layout.index] ||= kit.ghost(ctx.chars?.[layout.index]?.stage, 1.7));
        ghosts.forEach((o) => o && (o.visible = false));
        g.visible = true; g.position.set(layout.ghost.x, 0.95, layout.ghost.z);
        Object.assign(player, { x: START.x, z: START.z, yaw: 0, pitch: 0 });
        v.refresh();
      },
      refresh() {
        for (const r of recs) {
          const { it, m, aux } = r;
          m.visible = pz.visible(it.id);
          if (lay.kind === "lanterns") m.material = pz.found(it.id) ? mats.lit[it.color] : mats.dim[it.color];
          if (lay.kind === "secrets") { m.material = pz.found(it.id) ? mats.furOn : mats.fur; if (aux) aux.visible = !pz.found(it.id); }
        }
        if (doorMesh) doorMesh.material = run.canExit() ? mats.open : mats.locked;
      },
    };

    // input: keys, virtual stick (left thumb), drag to look (right side or mouse), tap to act
    const pad = document.createElement("div");
    pad.className = "rh-pad";
    const knob = document.createElement("div");
    knob.className = "rh-stick"; knob.innerHTML = "<i></i>";
    wrap.append(pad, knob);
    const ptrs = new Map();
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    const distTo = (it) => Math.hypot(it.x - player.x, it.z - player.z);
    const tap = (cx, cy) => {
      const r = pad.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(recs.filter((q) => q.m.visible).map((q) => q.m), false)[0];
      if (!hit) return;
      const rec = recs.find((q) => q.m === hit.object);
      if (distTo(rec.it) > 3.4) say(L.far); else act(rec.it.id);
    };
    pad.addEventListener("pointerdown", (e) => {
      pad.setPointerCapture?.(e.pointerId);
      const r = pad.getBoundingClientRect();
      const isStick = e.pointerType !== "mouse" && e.clientX - r.left < r.width * 0.45 && ![...ptrs.values()].some((p) => p.stick);
      ptrs.set(e.pointerId, { stick: isStick, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 });
      if (isStick) { knob.style.display = "block"; knob.style.left = `${e.clientX - r.left}px`; knob.style.top = `${e.clientY - r.top}px`; }
    });
    pad.addEventListener("pointermove", (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
      if (p.stick) {
        let sx = (p.x - p.x0) / 44, sy = (p.y - p.y0) / 44;
        const len = Math.hypot(sx, sy); if (len > 1) { sx /= len; sy /= len; }
        stick.x = Math.abs(sx) < 0.12 ? 0 : sx; stick.y = Math.abs(sy) < 0.12 ? 0 : sy;
        const i = knob.firstChild; i.style.transform = `translate(${sx * 30}px,${sy * 30}px)`;
      } else {
        player.yaw -= dx * 0.005; player.pitch = clamp(player.pitch - dy * 0.004, -0.8, 0.8);
      }
    });
    const up = (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      ptrs.delete(e.pointerId);
      if (p.stick) { stick.x = stick.y = 0; knob.style.display = "none"; knob.firstChild.style.transform = ""; }
      else if (e.type === "pointerup" && p.moved < 8 && performance.now() - p.t < 450) tap(e.clientX, e.clientY);
    };
    pad.addEventListener("pointerup", up); pad.addEventListener("pointercancel", up);
    const MOVE = { KeyW: "f", ArrowUp: "f", KeyS: "b", ArrowDown: "b", KeyA: "l", KeyD: "r", ArrowLeft: "tl", ArrowRight: "tr" };
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "")) return;
      if (MOVE[e.code]) { e.type === "keydown" ? keys.add(MOVE[e.code]) : keys.delete(MOVE[e.code]); e.preventDefault(); }
      else if ((e.code === "Space" || e.code === "Enter" || e.code === "KeyE") && e.type === "keydown" && e.target?.tagName !== "BUTTON") {
        e.preventDefault();
        const near = recs.filter((q) => q.m.visible).sort((a, b) => distTo(a.it) - distTo(b.it))[0];
        if (near && distTo(near.it) < 1.9) act(near.it.id);
      }
    };
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey); window.addEventListener("blur", onBlur);

    kit.add((dt, t) => {
      if (ended || !lay) return;
      run.tick(dt); tickClock();
      const f = (keys.has("f") ? 1 : 0) - (keys.has("b") ? 1 : 0) - stick.y, s = (keys.has("r") ? 1 : 0) - (keys.has("l") ? 1 : 0) + stick.x;
      player.yaw += ((keys.has("tl") ? 1 : 0) - (keys.has("tr") ? 1 : 0)) * 1.8 * dt;
      const len = Math.max(1, Math.hypot(f, s)), sp = 2.6 * dt / len, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      if (f || s) {
        const p = movePlayer(player, (-sy * f + cy * s) * sp, (-cy * f - sy * s) * sp, lay.boxes);
        player.x = p.x; player.z = p.z;
      }
      cam.position.set(player.x, 1.6, player.z);
      cam.rotation.set(player.pitch, player.yaw, 0);
      lantern.position.set(player.x, 1.9, player.z);
      for (const r of recs) {
        if (!r.m.visible) continue;
        if (lay.kind === "petals") r.m.position.y = 1.2 + Math.sin(t * 1.6) * 0.12;
        if (lay.kind === "items") { const k = 1 + Math.sin(t * 3 + r.it.x) * 0.2; r.m.scale.set(0.26 * k, 0.26 * k, 0.26 * k); r.m.rotation.y = t; }
        if (r.aux) r.aux.position.y = FURNITURE[r.it.name].size[1] + 0.35 + Math.sin(t * 2) * 0.06;
        if ((lay.kind === "items" || lay.kind === "petals") && distTo(r.it) < 0.95) { act(r.it.id); break; }
      }
      if (run.canExit() && Math.hypot(lay.door.x - player.x, lay.door.z - player.z) < DOOR.r) advance();
    });
    kit.start();
    return {
      setRoom: v.setRoom, refresh: v.refresh,
      dispose() {
        window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey); window.removeEventListener("blur", onBlur);
        pad.remove(); knob.remove(); kit.destroy();
      },
    };
  }

  async function begin() {
    const my = ++gen;
    view?.dispose(); view = null;
    ended = false; lastSec = -1; keys.clear();
    $(".rh-ctl").textContent = touchy ? L.ctlTouch : L.ctl;
    let v = null, used3D = false;
    try {
      const kitMod = await import("../three/kit.js");
      if (kitMod.canUse3D()) { v = await make3D(kitMod); used3D = true; }
    } catch { v = null; }
    if (my !== gen || destroyed) { v?.dispose(); return; }
    if (!used3D) { $(".rh-ctl").textContent = ""; v = make2D(); }
    view = v;
    tickClock();
    enterRoom();
  }
  begin();

  return {
    restart() { for (const id of timeouts) clearTimeout(id); timeouts.clear(); run = createRun(); begin(); },
    destroy() {
      destroyed = true; gen++;
      for (const id of timeouts) clearTimeout(id);
      timeouts.clear();
      view?.dispose(); view = null;
      style.remove(); root.replaceChildren();
    },
  };
}
