// Congklak: traditional Indonesian mancala, 2 x 7 holes + 2 stores (houses), 7 seeds per hole (98 seeds in all).
// Board = array of 16. 0-6 player holes, 7 player store, 8-14 opponent holes, 15 opponent store.
// Sowing runs counter-clockwise by index (i+1 mod 16), one seed per hole, into your own store but skipping the
// opponent's store. Hole i (0-6 / 8-14) faces hole 14-i. Where the LAST seed lands:
//  - your store: you move again;
//  - a non-empty hole (either side): pick up all its seeds and keep sowing (capped at MAX_CONT continuations);
//  - an empty hole on your side: capture the facing hole's seeds plus your last seed into your store (if the facing
//    hole is empty nothing happens); the turn ends;
//  - an empty hole on the opponent's side: the turn simply ends.
// The game ends when the side to move has no seeds in its holes; the remaining seeds go to the side owning those holes.
// Most seeds in store wins. Score = your store + 30 if you win + 10 more if you beat the hard ghost (Ngesomon).
export const MAX_CONT = 60;
export const HOLES = 7;
export const TOTAL = 98;
export const LEVELS = { "3": "easy", "4": "medium", "1": "mediumhard", "2": "hard" };
const storeOf = (side) => side * 8 + 7;
const sideOf = (i) => (i >= 8 ? 1 : 0);

export function initialState() {
  const b = new Array(16).fill(HOLES);
  b[7] = 0; b[15] = 0;
  return { b, turn: 0, over: false };
}
export function legalMoves(s) {
  if (s.over) return [];
  const out = [];
  for (let i = s.turn * 8; i < s.turn * 8 + HOLES; i++) if (s.b[i] > 0) out.push(i);
  return out;
}
function finish(s) {
  for (let side = 0; side < 2; side++) {
    for (let i = side * 8; i < side * 8 + HOLES; i++) { s.b[storeOf(side)] += s.b[i]; s.b[i] = 0; }
  }
  s.over = true;
}
// Returns { state, path, extra, captured }. path = [{ kind: "pick"|"drop"|"cap", i, b }] with board snapshots.
export function applyMove(state, from, record = true) {
  const b = state.b.slice(), side = state.turn;
  if (state.over || sideOf(from) !== side || from % 8 >= HOLES || b[from] <= 0) throw new Error("illegal move");
  const store = storeOf(side), skip = storeOf(1 - side), path = [];
  const log = (kind, i) => { if (record) path.push({ kind, i, b: b.slice() }); };
  let hand = b[from], i = from, cont = 0, extra = false, captured = 0;
  b[from] = 0; log("pick", from);
  for (;;) {
    while (hand > 0) { i = (i + 1) % 16; if (i === skip) continue; b[i]++; hand--; log("drop", i); }
    if (i === store) { extra = true; break; }
    if (b[i] > 1) {
      if (++cont > MAX_CONT) break;
      hand = b[i]; b[i] = 0; log("pick", i); continue;
    }
    if (sideOf(i) === side && b[14 - i] > 0) {
      captured = b[14 - i] + 1; b[store] += captured; b[14 - i] = 0; b[i] = 0; log("cap", i);
    }
    break;
  }
  const next = { b, turn: extra ? side : 1 - side, over: false };
  if (legalMoves(next).length === 0) finish(next);
  return { state: next, path, extra, captured };
}
export function winnerOf(s) { return s.b[7] > s.b[15] ? 0 : s.b[7] < s.b[15] ? 1 : -1; }
export function scoreOf(s, level) {
  const win = winnerOf(s) === 0;
  return s.b[7] + (win ? 30 + (level === "hard" ? 10 : 0) : 0);
}

// ---- AI (deterministic given rng: a function returning [0,1)) ----
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length];
const diffFor = (s, side) => s.b[storeOf(side)] - s.b[storeOf(1 - side)];
function bestBy(moves, rng, score) {
  let best = -Infinity, pool = [];
  for (const m of moves) {
    const v = score(m);
    if (v > best) { best = v; pool = [m]; } else if (v === best) pool.push(m);
  }
  return pickOne(pool, rng);
}
function greedy(s, rng, extraBonus) {
  const me = s.turn, base = diffFor(s, me);
  return bestBy(legalMoves(s), rng, (m) => {
    const r = applyMove(s, m, false);
    return diffFor(r.state, me) - base + (r.extra && !r.state.over ? extraBonus : 0);
  });
}
function evalLeaf(s, me) {
  let v = diffFor(s, me);
  if (!s.over) { let mine = 0, theirs = 0; for (let k = 0; k < HOLES; k++) { mine += s.b[me * 8 + k]; theirs += s.b[(1 - me) * 8 + k]; } v += 0.15 * (mine - theirs); }
  return v;
}
function search(s, depth, alpha, beta, me) {
  if (s.over || depth === 0) return evalLeaf(s, me);
  const max = s.turn === me;
  let best = max ? -Infinity : Infinity;
  for (const m of legalMoves(s)) {
    const v = search(applyMove(s, m, false).state, depth - 1, alpha, beta, me);
    if (max) { if (v > best) best = v; if (v > alpha) alpha = v; } else { if (v < best) best = v; if (v < beta) beta = v; }
    if (alpha >= beta) break;
  }
  return best;
}
export function chooseMove(s, level, rng = Math.random) {
  const moves = legalMoves(s);
  if (moves.length === 1) return moves[0];
  if (level === "easy") return rng() < 0.4 ? greedy(s, rng, 0) : pickOne(moves, rng);
  if (level === "medium") return greedy(s, rng, 0);
  if (level === "mediumhard") return greedy(s, rng, 3);
  const me = s.turn;
  return bestBy(moves, rng, (m) => search(applyMove(s, m, false).state, 3, -Infinity, Infinity, me) + rng() * 1e-6);
}

// ---- DOM layer ----
const TEXT = {
  en: {
    pick: "Pick the opponent", lv: { easy: "gentle", medium: "steady", mediumhard: "sharp", hard: "relentless" },
    yourTurn: "Your turn: pick one of your holes.", theirTurn: (n) => `${n} is sowing...`, again: "Landed in your house: go again!",
    cap: (n) => `Captured ${n} seeds!`, youHouse: "You", hole: (n, c) => `Hole ${n}, ${c} seeds`, win: "You win!", lose: "They win.", draw: "A draw.",
    skip: "Quiet turn.", store: "house",
  },
  id: {
    pick: "Pilih lawan", lv: { easy: "santai", medium: "stabil", mediumhard: "tajam", hard: "tanpa ampun" },
    yourTurn: "Giliranmu: pilih salah satu lubangmu.", theirTurn: (n) => `${n} lagi menabur...`, again: "Mendarat di lumbungmu: jalan lagi!",
    cap: (n) => `Menang ${n} biji!`, youHouse: "Kamu", hole: (n, c) => `Lubang ${n}, ${c} biji`, win: "Kamu menang!", lose: "Dia menang.", draw: "Seri.",
    skip: "Giliran sepi.", store: "lumbung",
  },
};
const CSS = `
.cg{display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px;height:100%;justify-content:center;font-family:var(--comic,inherit)}
.cg-pick{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.cg-opp{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 12px;border:2px solid var(--accent,#999);border-radius:14px;background:transparent;color:inherit;cursor:pointer;font:inherit}
.cg-opp img{width:56px;height:56px;border-radius:50%;object-fit:cover}
.cg-board{display:grid;grid-template-columns:minmax(36px,1.3fr) repeat(7,minmax(0,1fr)) minmax(36px,1.3fr);grid-template-rows:1fr 1fr;gap:6px;width:100%;max-width:560px;padding:10px;border-radius:20px;background:color-mix(in srgb,var(--accent,#999) 22%,transparent);border:2px solid var(--accent,#999)}
.cg-h,.cg-s{display:flex;align-items:center;justify-content:center;border-radius:50%;aspect-ratio:1;border:2px solid var(--accent,#999);background:rgba(0,0,0,.25);color:inherit;font:inherit;font-weight:700;font-size:clamp(13px,3.6vw,20px);padding:0;transition:transform .12s,background .12s}
.cg-s{grid-row:1/3;border-radius:999px;aspect-ratio:auto;min-height:90px}
button.cg-h:not(:disabled){cursor:pointer}
button.cg-h:not(:disabled):hover,button.cg-h:focus-visible{background:color-mix(in srgb,var(--accent,#999) 45%,transparent);outline:2px solid #fff}
button.cg-h:disabled{color:inherit;opacity:1}
.cg-h.hot,.cg-s.hot{transform:scale(1.12);background:color-mix(in srgb,var(--accent,#999) 60%,transparent)}
.cg-st{min-height:1.4em;text-align:center}
.cg.rm *{transition:none!important}`;

export function start(root, ctx) {
  const L = TEXT[ctx.lang] || TEXT.en;
  if (!document.getElementById("css-congklak")) {
    const st = document.createElement("style"); st.id = "css-congklak"; st.textContent = CSS; document.head.appendChild(st);
  }
  const timers = new Set();
  let run = 0, state, level, oppId, busy, done, cells = [], status;
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  const nameOf = (id) => (ctx.chars.find((c) => c.id === id) || {}).name || "";
  const wrap = document.createElement("div");
  wrap.className = "cg" + (ctx.reduceMotion ? " rm" : "");
  root.appendChild(wrap);

  function menu() {
    run++; done = false; busy = true; wrap.innerHTML = "";
    const h = document.createElement("div"); h.textContent = L.pick; wrap.appendChild(h);
    const row = document.createElement("div"); row.className = "cg-pick"; wrap.appendChild(row);
    for (const c of ctx.chars) {
      const b = document.createElement("button"); b.className = "cg-opp"; b.type = "button";
      b.innerHTML = `<img alt="" src="${c.head || c.image || ""}"><b></b><small></small>`;
      b.querySelector("b").textContent = c.name; b.querySelector("small").textContent = L.lv[LEVELS[c.id]];
      b.onclick = () => begin(c.id);
      row.appendChild(b);
    }
  }
  function begin(id) {
    oppId = id; level = LEVELS[id]; state = initialState(); busy = false; done = false; wrap.innerHTML = "";
    status = document.createElement("div"); status.className = "cg-st"; status.setAttribute("aria-live", "polite");
    const board = document.createElement("div"); board.className = "cg-board"; board.setAttribute("role", "group");
    cells = [];
    const mk = (i, tag, col, rowN) => {
      const e = document.createElement(tag); e.className = i % 8 === 7 ? "cg-s" : "cg-h";
      e.style.gridColumn = col; if (rowN) e.style.gridRow = rowN;
      if (tag === "button") { e.type = "button"; e.onclick = () => play(i); e.onkeydown = (ev) => arrow(ev, i); }
      else e.setAttribute("aria-label", i === 15 ? `${nameOf(oppId)} ${L.store}` : `${nameOf(oppId)}`);
      cells[i] = e; board.appendChild(e);
    };
    mk(15, "div", 1);
    for (let k = 8; k <= 14; k++) mk(k, "div", 15 - k + 1 + 0, 1);
    for (let h = 0; h < 7; h++) mk(h, "button", h + 2, 2);
    mk(7, "div", 9);
    // top row sits in grid columns 2-8: opponent hole k -> column 17-k
    for (let k = 8; k <= 14; k++) cells[k].style.gridColumn = String(17 - k);
    wrap.append(status, board);
    render(state.b); turnInfo();
  }
  function render(b) {
    for (let i = 0; i < 16; i++) {
      cells[i].textContent = b[i]; cells[i].classList.remove("hot");
      if (i < 7) cells[i].setAttribute("aria-label", L.hole(i + 1, b[i]));
      if (i === 7) cells[i].setAttribute("aria-label", `${L.youHouse} ${L.store}: ${b[i]}`);
    }
    const mine = !busy && state && state.turn === 0 && !state.over;
    for (let i = 0; i < 7; i++) cells[i].disabled = !(mine && b[i] > 0);
  }
  function turnInfo(msg) {
    status.textContent = msg || (state.turn === 0 ? L.yourTurn : L.theirTurn(nameOf(oppId)));
    if (state.turn === 0 && !busy) { const f = cells.find((c, i) => i < 7 && !c.disabled); if (f && document.activeElement === document.body) f.focus({ preventScroll: true }); }
  }
  function arrow(ev, i) {
    const d = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    for (let k = i + d; k >= 0 && k < 7; k += d) if (!cells[k].disabled) { cells[k].focus(); ev.preventDefault(); return; }
  }
  function play(i) {
    if (busy || done || state.over) return;
    const my = run, r = applyMove(state, i);
    busy = true; render(state.b);
    const delay = ctx.reduceMotion ? 0 : Math.max(35, Math.min(120, 4500 / Math.max(1, r.path.length)));
    const wasMe = state.turn === 0;
    let n = 0;
    const step = () => {
      if (my !== run) return;
      if (n < r.path.length && delay) {
        const p = r.path[n++]; render(p.b); cells[p.i].classList.add("hot"); later(step, delay);
      } else after();
    };
    const after = () => {
      state = r.state; busy = false; render(state.b);
      if (state.over) return end();
      const note = r.captured ? L.cap(r.captured) : r.extra && wasMe ? L.again : "";
      turnInfo(note || undefined);
      if (state.turn === 1) { busy = true; render(state.b); later(() => { if (my === run) play(chooseMove(state, level, Math.random)); }, ctx.reduceMotion ? 0 : 650); }
    };
    step();
  }
  function end() {
    done = true; busy = true; render(state.b);
    const w = winnerOf(state);
    status.textContent = `${w === 0 ? L.win : w === 1 ? L.lose : L.draw} ${state.b[7]} : ${state.b[15]}`;
    const my = run, score = scoreOf(state, level);
    later(() => { if (my === run) ctx.onOver(score, { char: oppId }); }, ctx.reduceMotion ? 0 : 900);
  }
  menu();
  return {
    restart() { timers.forEach(clearTimeout); timers.clear(); menu(); },
    destroy() { run++; timers.forEach(clearTimeout); timers.clear(); wrap.remove(); },
  };
}
