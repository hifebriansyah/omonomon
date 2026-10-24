// Tali Lepas: untangle the ropes. Drag the knots until no two ropes cross. One run lasts 90 seconds.
// A solved level scores 20 + 2 per second left on its 30 s clock; "skip" costs 5 points (never below 0).
// The rules (createRun, makeLevel, ...) know nothing about the page, so tests/rope-untangle.test.mjs can run them alone.

export const RUN_SECONDS = 90;
export const LEVEL_SECONDS = 30;
export const SKIP_COST = 5;

export const knotsFor = (level) => Math.min(14, 5 + level + Math.floor(level / 2)); // 5,6,8,9,11,12,14...
export const solveScore = (secLeft) => 20 + 2 * Math.max(0, Math.min(LEVEL_SECONDS, Math.floor(secLeft)));

const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);

// Do segments p1p2 and p3p4 cross? Ropes that share a knot never count.
export function segmentsCross(p1, p2, p3, p4) {
  const d1 = ccw(p3, p4, p1), d2 = ccw(p3, p4, p2), d3 = ccw(p1, p2, p3), d4 = ccw(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Indices of the edges (pairs [a, b] of knot indexes) that cross at least one other edge.
export function crossingEdges(pts, edges) {
  const bad = new Set();
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segmentsCross(pts[a], pts[b], pts[c], pts[d])) { bad.add(i); bad.add(j); }
    }
  }
  return bad;
}
export const countCrossings = (pts, edges) => crossingEdges(pts, edges).size;

// A level: `solution` is a layout with no crossings; `pts` is the same knots scrambled so that ropes cross.
export function makeLevel(n, rng = Math.random) {
  const solution = Array.from({ length: n }, () => ({ x: 0.06 + rng() * 0.88, y: 0.06 + rng() * 0.88 }));
  const pairs = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    pairs.push({ a, b, w: Math.hypot(solution[a].x - solution[b].x, solution[a].y - solution[b].y) * (0.6 + rng() * 0.8) });
  }
  pairs.sort((p, q) => p.w - q.w);
  const target = Math.min(3 * n - 6, Math.round(n * 1.5));
  const edges = [];
  const deg = new Array(n).fill(0);
  for (const { a, b } of pairs) {
    if (edges.length >= target) break;
    if (deg[a] >= 4 || deg[b] >= 4) continue;
    const ok = edges.every(([c, d]) => c === a || c === b || d === a || d === b ||
      !segmentsCross(solution[a], solution[b], solution[c], solution[d]));
    if (ok) { edges.push([a, b]); deg[a]++; deg[b]++; }
  }
  // Scramble: shuffle the layout until enough ropes cross (a handful of tries; keep the messiest).
  const want = Math.max(2, Math.floor(edges.length / 3));
  let best = null, bestC = -1;
  for (let tries = 0; tries < 60; tries++) {
    const pts = solution.map(() => ({ x: 0.06 + rng() * 0.88, y: 0.06 + rng() * 0.88 }));
    const c = countCrossings(pts, edges);
    if (c > bestC) { best = pts; bestC = c; }
    if (c >= want) break;
  }
  return { n, edges, solution, pts: best };
}

// One run. tick(dt) moves the clock; move(i, x, y) drags a knot (0..1); skip() gives up the level.
export function createRun({ rng = Math.random } = {}) {
  const st = { t: 0, levelT: 0, level: 0, score: 0, solved: 0, over: false, bad: new Set(), g: null };
  const load = () => { st.g = makeLevel(knotsFor(st.level), rng); st.levelT = 0; st.bad = crossingEdges(st.g.pts, st.g.edges); };
  load();
  const next = () => { st.level += 1; load(); };
  return {
    state: () => st,
    tick(dt) {
      if (st.over) return;
      st.t += dt; st.levelT += dt;
      if (st.t >= RUN_SECONDS) { st.t = RUN_SECONDS; st.over = true; }
    },
    move(i, x, y) {
      if (st.over || !st.g.pts[i]) return null;
      st.g.pts[i] = { x: Math.min(0.97, Math.max(0.03, x)), y: Math.min(0.97, Math.max(0.03, y)) };
      st.bad = crossingEdges(st.g.pts, st.g.edges);
      return st.bad.size === 0 ? "solved" : null;
    },
    // Call after the drag ends (not during it) so a half-way drop does not end the level by accident.
    finish() {
      if (st.over || st.bad.size) return 0;
      const gain = solveScore(LEVEL_SECONDS - st.levelT);
      st.score += gain; st.solved += 1; next();
      return gain;
    },
    skip() {
      if (st.over) return 0;
      const cost = Math.min(SKIP_COST, st.score);
      st.score -= cost; next();
      return cost;
    },
  };
}

const TEXT = {
  en: {
    time: (s) => `${s}s`, score: (n) => `${n} pts`, level: (n) => `Level ${n}`, skip: "Skip level (-5)",
    hint: "Drag the knots until no rope crosses.", ok: (g) => `Untangled! +${g}`, skipped: "Skipped.",
    board: "Rope board: drag the knots", knot: (i) => `Knot ${i}`, start: "Tap Start. Drag the knots until no ropes cross.", go: "Start",
    clock: (s) => `Level clock: ${s}s left for the bonus`,
  },
  id: {
    time: (s) => `${s} dtk`, score: (n) => `${n} poin`, level: (n) => `Level ${n}`, skip: "Lewati level (-5)",
    hint: "Seret simpulnya sampai tidak ada tali yang bersilang.", ok: (g) => `Terurai! +${g}`, skipped: "Dilewati.",
    board: "Papan tali: seret simpulnya", knot: (i) => `Simpul ${i}`, start: "Ketuk Mulai. Seret simpulnya sampai tidak ada tali bersilang.", go: "Mulai",
    clock: (s) => `Jam level: sisa ${s} dtk untuk bonus`,
  },
};

const CSS = `
.tl{display:flex;flex-direction:column;gap:8px;height:100%;padding:10px;box-sizing:border-box;color:#eee;font-family:var(--comic,inherit)}
.tl-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700}
.tl-time{font-size:1.4rem}.tl-time[data-low="1"]{color:#ff6b6b}
.tl-meter{height:5px;background:#ffffff22;border-radius:3px;overflow:hidden}.tl-meter i{display:block;height:100%;background:var(--accent,#9aa);width:100%}
.tl-svg{flex:1;min-height:0;width:100%;max-height:70vh;aspect-ratio:1/1;align-self:center;background:#0006;border-radius:10px;touch-action:none}
.tl-rope{stroke:#d8d0c0;stroke-width:.9;stroke-linecap:round}.tl-rope.bad{stroke:#ff4d4d;stroke-width:1.2}
.tl-knot{fill:var(--accent,#9aa);stroke:#fff;stroke-width:.6;cursor:grab}.tl-knot.drag{fill:#fff}
.tl-hit{fill:transparent;cursor:grab;touch-action:none}
.tl-msg{min-height:1.3em;text-align:center;font-size:.9rem}
.tl-btn{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #fff5;background:#ffffff18;color:inherit;cursor:pointer}
.tl-btn:focus-visible{outline:2px solid #fff}
.tl-ok{animation:tlp .5s}@keyframes tlp{50%{filter:brightness(1.8)}}
.tl-reduce .tl-ok{animation:none}`;

export function start(root, ctx) {
  const T = TEXT[ctx.lang === "id" ? "id" : "en"];
  const NS = "http://www.w3.org/2000/svg";
  if (!document.getElementById("css-rope-untangle")) {
    const s = document.createElement("style"); s.id = "css-rope-untangle"; s.textContent = CSS; document.head.appendChild(s);
  }
  root.textContent = "";
  root.insertAdjacentHTML("beforeend",
    `<div class="tl${ctx.reduceMotion ? " tl-reduce" : ""}"><div class="tl-bar"><span class="tl-level"></span><span class="tl-time" aria-hidden="true"></span><span class="tl-score" aria-live="polite"></span></div>
    <div class="tl-meter" role="img"><i></i></div><svg class="tl-svg" viewBox="0 0 100 100" role="group"></svg>
    <div class="tl-msg" role="status"></div><div style="text-align:center"><button type="button" class="tl-btn tl-skip"></button></div></div>`);
  const $ = (q) => root.querySelector(q);
  const svg = $(".tl-svg"), msg = $(".tl-msg"), timeEl = $(".tl-time"), meter = $(".tl-meter i");
  svg.setAttribute("aria-label", T.board);
  $(".tl-skip").textContent = T.skip;
  $(".tl-meter").setAttribute("aria-label", "");

  let run = null, timer = 0, last = 0, ropes = [], knots = [], drag = -1, done = false, gen = 0, lastShown = "";
  const P = (v) => (v * 100).toFixed(2);

  function build() {
    svg.textContent = "";
    const g = run.state().g;
    ropes = g.edges.map(() => { const l = document.createElementNS(NS, "line"); l.setAttribute("class", "tl-rope"); svg.appendChild(l); return l; });
    knots = g.pts.map((_, i) => {
      const grp = document.createElementNS(NS, "g");
      const k = document.createElementNS(NS, "circle"); k.setAttribute("class", "tl-knot"); k.setAttribute("r", "3");
      const h = document.createElementNS(NS, "circle"); h.setAttribute("class", "tl-hit"); h.setAttribute("r", "7");
      h.setAttribute("aria-label", T.knot(i + 1));
      h.addEventListener("pointerdown", (e) => { if (done) return; e.preventDefault(); drag = i; h.setPointerCapture(e.pointerId); k.classList.add("drag"); });
      h.addEventListener("pointermove", (e) => { if (drag === i) moveTo(i, e); });
      const end = () => { if (drag !== i) return; drag = -1; k.classList.remove("drag"); finish(); };
      h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
      grp.append(k, h); svg.appendChild(grp);
      return { k, h };
    });
    paint();
  }

  function moveTo(i, e) {
    const m = svg.getScreenCTM(); if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    run.move(i, p.x / 100, p.y / 100);
    paint();
  }

  function paint() {
    const st = run.state(), g = st.g;
    g.edges.forEach(([a, b], i) => {
      const r = ropes[i];
      r.setAttribute("x1", P(g.pts[a].x)); r.setAttribute("y1", P(g.pts[a].y));
      r.setAttribute("x2", P(g.pts[b].x)); r.setAttribute("y2", P(g.pts[b].y));
      r.classList.toggle("bad", st.bad.has(i));
    });
    g.pts.forEach((p, i) => {
      for (const el of [knots[i].k, knots[i].h]) { el.setAttribute("cx", P(p.x)); el.setAttribute("cy", P(p.y)); }
    });
    $(".tl-level").textContent = T.level(st.level + 1);
    $(".tl-score").textContent = T.score(st.score);
  }

  function finish() {
    const gain = run.finish();
    if (!gain) return;
    say(T.ok(gain));
    build();
    if (!ctx.reduceMotion) { svg.classList.remove("tl-ok"); void svg.getBoundingClientRect(); svg.classList.add("tl-ok"); }
  }

  const say = (s) => { msg.textContent = s; };

  function loop() {
    const now = performance.now();
    run.tick(Math.min(0.25, (now - last) / 1000));
    last = now;
    const st = run.state();
    const left = Math.max(0, Math.ceil(RUN_SECONDS - st.t));
    timeEl.textContent = T.time(left);
    timeEl.dataset.low = left <= 10 ? "1" : "0";
    meter.style.width = `${Math.max(0, 100 * (1 - st.levelT / LEVEL_SECONDS))}%`;
    const shown = String(Math.max(0, Math.ceil(LEVEL_SECONDS - st.levelT)));
    if (shown !== lastShown) { lastShown = shown; $(".tl-meter").setAttribute("aria-label", T.clock(shown)); }
    if (st.over && !done) {
      done = true; clearInterval(timer); timer = 0;
      ctx.onOver(Math.max(0, Math.floor(st.score)));
    }
  }

  function begin() {
    clearInterval(timer);
    gen += 1; done = false; drag = -1;
    run = createRun();
    build();
    say(T.hint);
    last = performance.now();
    timer = setInterval(loop, 100);
    loop();
  }

  $(".tl-skip").addEventListener("click", () => { if (done) return; run.skip(); build(); say(T.skipped); });
  begin();
  return {
    restart() { begin(); },
    destroy() { clearInterval(timer); timer = 0; done = true; root.textContent = ""; document.getElementById("css-rope-untangle")?.remove(); },
  };
}
