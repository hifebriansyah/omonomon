// Bunga Kenangan: a calm match-3. No timer; a fixed number of moves. Pure engine first, DOM layer (start) below.
// Board: board[row][col] = 0..KINDS-1 (null only while resolving). Score: 10 per petal, cascade steps multiply x1, x2, x3...

export const SIZE = 7;
export const KINDS = 5;
export const MOVES = 20;
export const PETAL_POINTS = 10;

export const makeRng = (seed = 1) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = (rng, n) => Math.floor(rng() * n) % n;
export const cloneBoard = (b) => b.map((r) => r.slice());

// Cells (as "r,c" keys) that sit in a run of 3+ in a row or column.
export function findMatches(board) {
  const n = board.length, hit = new Set();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = board[r][c];
      if (v == null) continue;
      if (c + 2 < n && board[r][c + 1] === v && board[r][c + 2] === v) [0, 1, 2].forEach((k) => hit.add(`${r},${c + k}`));
      if (r + 2 < n && board[r + 1][c] === v && board[r + 2][c] === v) [0, 1, 2].forEach((k) => hit.add(`${r + k},${c}`));
    }
  }
  return hit;
}

export const isAdjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

export function swapped(board, a, b) {
  const nb = cloneBoard(board);
  [nb[a.r][a.c], nb[b.r][b.c]] = [nb[b.r][b.c], nb[a.r][a.c]];
  return nb;
}

// A swap is valid if the cells are neighbours and the swapped board has a match.
export const isValidSwap = (board, a, b) => isAdjacent(a, b) && findMatches(swapped(board, a, b)).size > 0;

export function hasMove(board) {
  const n = board.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c + 1 < n && isValidSwap(board, { r, c }, { r, c: c + 1 })) return true;
      if (r + 1 < n && isValidSwap(board, { r, c }, { r: r + 1, c })) return true;
    }
  }
  return false;
}

// Drop petals down within each column and fill the gaps from the top with new ones.
export function gravity(board, rng) {
  const n = board.length, nb = cloneBoard(board);
  for (let c = 0; c < n; c++) {
    const keep = [];
    for (let r = n - 1; r >= 0; r--) if (nb[r][c] != null) keep.push(nb[r][c]);
    for (let r = n - 1, i = 0; r >= 0; r--, i++) nb[r][c] = i < keep.length ? keep[i] : pick(rng, KINDS);
  }
  return nb;
}

// A fresh board with no matches and at least one move.
export function createBoard(rng, size = SIZE) {
  for (;;) {
    const b = Array.from({ length: size }, () => Array.from({ length: size }, () => pick(rng, KINDS)));
    for (let guard = 0; guard < 200 && findMatches(b).size; guard++) {
      for (const k of findMatches(b)) { const [r, c] = k.split(",").map(Number); b[r][c] = pick(rng, KINDS); }
    }
    if (!findMatches(b).size && hasMove(b)) return b;
  }
}

// Clears matches, drops, refills, repeats. Returns the final board, the points and each cascade step.
export function resolve(board, rng) {
  let b = cloneBoard(board), total = 0, mult = 1;
  const steps = [];
  for (let m = findMatches(b); m.size; m = findMatches(b)) {
    const cleared = [...m].map((k) => k.split(",").map(Number));
    const points = cleared.length * PETAL_POINTS * mult;
    cleared.forEach(([r, c]) => { b[r][c] = null; });
    b = gravity(b, rng);
    total += points;
    steps.push({ cleared, mult, points, board: cloneBoard(b) });
    mult += 1;
  }
  return { board: b, points: total, steps };
}

// Same petals, new places, until nothing matches and a move exists.
export function reshuffle(board, rng) {
  const flat = board.flat(), n = board.length;
  for (let tries = 0; tries < 50; tries++) {
    for (let i = flat.length - 1; i > 0; i--) { const j = pick(rng, i + 1); [flat[i], flat[j]] = [flat[j], flat[i]]; }
    const b = Array.from({ length: n }, (_, r) => flat.slice(r * n, r * n + n));
    if (!findMatches(b).size && hasMove(b)) return b;
  }
  return createBoard(rng, n);
}

export function createEngine({ rng = Math.random, size = SIZE, moves = MOVES } = {}) {
  const s = { board: createBoard(rng, size), moves, score: 0, over: false };
  return {
    state: s,
    // Returns { valid, points, steps, reshuffled }. An invalid swap costs nothing.
    swap(a, b) {
      if (s.over || !isValidSwap(s.board, a, b)) return { valid: false, points: 0, steps: [], reshuffled: false };
      const res = resolve(swapped(s.board, a, b), rng);
      s.board = res.board; s.score += res.points; s.moves -= 1;
      let reshuffled = false;
      if (s.moves > 0 && !hasMove(s.board)) { s.board = reshuffle(s.board, rng); reshuffled = true; }
      if (s.moves <= 0) s.over = true;
      return { valid: true, points: res.points, steps: res.steps, reshuffled };
    },
  };
}

// ---------- DOM layer ----------
const TEXT = {
  en: { moves: "Moves", score: "Petals", hint: "Swap two neighbouring petals to line up three.", wiggle: "That one does not fit.", shuffle: "The petals drift into new places.",
        over: "The garden rests.", cell: (k, r, c) => `${["round pink", "pointed gold", "square blue", "diamond green", "star violet"][k]} petal, row ${r + 1}, column ${c + 1}`, chain: (n) => `Chain x${n}` },
  id: { moves: "Langkah", score: "Kelopak", hint: "Tukar dua kelopak yang bersebelahan sampai tiga sejajar.", wiggle: "Yang itu nggak cocok.", shuffle: "Kelopaknya bergeser ke tempat baru.",
        over: "Tamannya beristirahat.", cell: (k, r, c) => `kelopak ${["bulat merah muda", "runcing emas", "kotak biru", "belah ketupat hijau", "bintang ungu"][k]}, baris ${r + 1}, kolom ${c + 1}`, chain: (n) => `Rantai x${n}` },
};
const GLYPHS = ["●", "▲", "■", "◆", "★"];
const COLORS = ["#e59ab8", "#d9b45a", "#6f9fd8", "#74b98a", "#a98bd8"];
const CSS = `
.bk{display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px;width:100%;height:100%;box-sizing:border-box;justify-content:center;color:#e8e2f0}
.bk-bar{display:flex;gap:18px;font-size:14px;opacity:.85}.bk-bar b{font-size:18px;font-variant-numeric:tabular-nums}
.bk-grid{display:grid;gap:4px;width:min(92%,420px);aspect-ratio:1;touch-action:none}
.bk-c{border:0;border-radius:12px;background:rgba(255,255,255,.07);font-size:min(7vw,30px);line-height:1;padding:0;cursor:pointer;transition:transform .18s,opacity .25s,background .2s;color:var(--c)}
.bk-c:focus-visible{outline:2px solid var(--accent,#fff);outline-offset:1px}
.bk-c.sel{background:rgba(255,255,255,.25);transform:scale(1.08)}
.bk-c.pop{opacity:0;transform:scale(.4)}
.bk-c.no{animation:bk-wig .3s}
@keyframes bk-wig{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.bk-msg{min-height:20px;font-size:13px;opacity:.8;text-align:center}
.bk.calm .bk-c,.bk.calm .bk-c.no{transition:none;animation:none}
`;

export function start(root, ctx) {
  const L = TEXT[ctx.lang === "id" ? "id" : "en"];
  if (!document.getElementById("css-memory-garden")) {
    const st = document.createElement("style"); st.id = "css-memory-garden"; st.textContent = CSS; document.head.appendChild(st);
  }
  root.innerHTML = `<div class="bk${ctx.reduceMotion ? " calm" : ""}"><div class="bk-bar"><span>${L.moves} <b data-m></b></span><span>${L.score} <b data-s></b></span></div><div class="bk-grid" role="grid"></div><div class="bk-msg" aria-live="polite"></div></div>`;
  const grid = root.querySelector(".bk-grid"), mEl = root.querySelector("[data-m]"), sEl = root.querySelector("[data-s]"), msg = root.querySelector(".bk-msg");
  const wait = (ms) => new Promise((r) => setTimeout(r, ctx.reduceMotion ? 0 : ms));
  let eng, sel = null, busy = false, run = 0, finished = false, dead = false, down = null;
  const cells = [];
  grid.style.gridTemplateColumns = `repeat(${SIZE},1fr)`;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const b = document.createElement("button"); b.type = "button"; b.className = "bk-c"; b.dataset.r = r; b.dataset.c = c; b.setAttribute("role", "gridcell");
    grid.appendChild(b); cells.push(b);
  }
  const at = (r, c) => cells[r * SIZE + c];
  function paint(board = eng.state.board) {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const el = at(r, c), k = board[r][c];
      el.textContent = GLYPHS[k]; el.style.setProperty("--c", COLORS[k]); el.setAttribute("aria-label", L.cell(k, r, c)); el.classList.remove("pop", "sel", "no");
    }
    mEl.textContent = eng.state.moves; sEl.textContent = eng.state.score;
  }
  function select(p) { cells.forEach((e) => e.classList.remove("sel")); sel = p; if (p) at(p.r, p.c).classList.add("sel"); }
  async function attempt(a, b) {
    if (busy || dead || !isAdjacent(a, b)) return;
    busy = true; select(null);
    const id = run, res = eng.swap(a, b);
    if (!res.valid) {
      [at(a.r, a.c), at(b.r, b.c)].forEach((e) => e.classList.add("no"));
      msg.textContent = L.wiggle; await wait(320);
      if (id === run) cells.forEach((e) => e.classList.remove("no"));
      busy = false; return;
    }
    msg.textContent = "";
    for (const st of res.steps) {
      st.cleared.forEach(([r, c]) => at(r, c).classList.add("pop"));
      if (st.mult > 1) msg.textContent = L.chain(st.mult);
      await wait(280); if (id !== run || dead) return;
      paint(st.board); sEl.textContent = eng.state.score - res.steps.filter((x) => x.mult > st.mult).reduce((t, x) => t + x.points, 0);
    }
    paint();
    if (res.reshuffled) msg.textContent = L.shuffle;
    busy = false;
    if (eng.state.over && !finished) { finished = true; msg.textContent = L.over; await wait(500); if (id === run && !dead) ctx.onOver(eng.state.score); }
  }
  function tap(r, c) {
    if (busy || dead) return;
    const p = { r, c };
    if (!sel) return select(p);
    if (sel.r === r && sel.c === c) return select(null);
    if (isAdjacent(sel, p)) { const a = sel; attempt(a, p); } else select(p);
  }
  const posOf = (t) => { const e = t.closest && t.closest(".bk-c"); return e ? { r: +e.dataset.r, c: +e.dataset.c } : null; };
  const onDown = (e) => { down = { p: posOf(e.target), x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    const d = down; down = null;
    if (!d || !d.p) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return tap(d.p.r, d.p.c);
    const n = Math.abs(dx) > Math.abs(dy) ? { r: d.p.r, c: d.p.c + Math.sign(dx) } : { r: d.p.r + Math.sign(dy), c: d.p.c };
    if (n.r >= 0 && n.c >= 0 && n.r < SIZE && n.c < SIZE) attempt(d.p, n);
  };
  const onKey = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("bk-c")) { e.preventDefault(); tap(+e.target.dataset.r, +e.target.dataset.c); } };
  grid.addEventListener("pointerdown", onDown); grid.addEventListener("pointerup", onUp); grid.addEventListener("keydown", onKey);
  function restart() { run += 1; finished = false; busy = false; dead = false; eng = createEngine(); select(null); msg.textContent = L.hint; paint(); }
  restart();
  return { restart, destroy() { dead = true; run += 1; grid.removeEventListener("pointerdown", onDown); grid.removeEventListener("pointerup", onUp); grid.removeEventListener("keydown", onKey); root.textContent = ""; } };
}
