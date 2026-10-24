// Obat Malam (Night Meds): pills fall; send each to its patient's tray (colour AND shape) before it reaches the floor.
// Right tray +10 (+15 once the streak is 5+), wrong tray or a missed pill costs one of 3 lives. It speeds up.
// createEngine holds the rules and knows nothing about the page; start() adds the markup.

const LIVES = 3;
const ZONE = 0.3; // a pill can be sorted once it has fallen this far (0..1)
export const TRAYS = 3;

export function createEngine({ rng = Math.random, lives = LIVES } = {}) {
  const st = { t: 0, score: 0, lives, streak: 0, best: 0, sorted: 0, over: false, pill: null, nextAt: 0.6 };
  const fallAt = (t) => Math.max(1.1, 3.4 - t * 0.025); // seconds a pill takes to fall
  const gapAt = (t) => Math.max(0.25, 0.7 - t * 0.006);

  const lose = (events) => {
    st.lives -= 1;
    st.streak = 0;
    if (st.lives <= 0) { st.over = true; events.push({ type: "over" }); }
  };

  // Move time forward by dt seconds. Events: {type: "spawn", kind} | {type: "miss"} | {type: "over"}
  function tick(dt) {
    const events = [];
    if (st.over) return events;
    st.t += dt;
    const p = st.pill;
    if (p) {
      p.p += dt / p.fall;
      if (p.p >= 1) { st.pill = null; st.nextAt = st.t + gapAt(st.t); events.push({ type: "miss", kind: p.kind }); lose(events); }
    } else if (st.t >= st.nextAt) {
      st.pill = { kind: Math.floor(rng() * TRAYS), p: 0, fall: fallAt(st.t) };
      events.push({ type: "spawn", kind: st.pill.kind });
    }
    return events;
  }

  // Send the current pill to tray i. Before the pill reaches the drop zone nothing happens.
  function choose(i) {
    const p = st.pill;
    if (st.over || !p || p.p < ZONE || !(i >= 0 && i < TRAYS)) return [{ type: "idle" }];
    const events = [];
    st.pill = null;
    st.nextAt = st.t + gapAt(st.t);
    if (i === p.kind) {
      st.streak += 1;
      st.best = Math.max(st.best, st.streak);
      st.sorted += 1;
      const gain = st.streak >= 5 ? 15 : 10;
      st.score += gain;
      events.push({ type: "ok", i, gain, streak: st.streak });
    } else {
      events.push({ type: "wrong", i, kind: p.kind });
      lose(events);
    }
    return events;
  }

  return { tick, choose, state: () => st };
}

const TEXT = {
  en: {
    score: "Score", lives: (n) => `${n} ${n === 1 ? "life" : "lives"} left`, tray: ["Bed 1, red circle", "Bed 2, blue square", "Bed 3, yellow triangle"],
    hint: "Tap the matching bed (or press 1, 2, 3)", ok: ["Good", "Fed", "Checked"], bad: "Wrong bed!", miss: "Missed one!", streak: (n) => `Streak ${n}`,
    pill: ["red circle pill", "blue square pill", "yellow triangle pill"],
  },
  id: {
    score: "Skor", lives: (n) => `Sisa ${n} nyawa`, tray: ["Ranjang 1, lingkaran merah", "Ranjang 2, kotak biru", "Ranjang 3, segitiga kuning"],
    hint: "Ketuk ranjang yang cocok (atau tekan 1, 2, 3)", ok: ["Bagus", "Sudah minum", "Beres"], bad: "Salah ranjang!", miss: "Ada yang lolos!", streak: (n) => `Beruntun ${n}`,
    pill: ["pil lingkaran merah", "pil kotak biru", "pil segitiga kuning"],
  },
};
const COLORS = ["#e5484d", "#3e7bfa", "#f2c230"];
const SHAPES = ["●", "■", "▲"];

const CSS = `
.om{position:relative;height:100%;min-height:360px;display:flex;flex-direction:column;background:linear-gradient(#10151f,#1a2330);color:#eef2f7;overflow:hidden;user-select:none;touch-action:manipulation}
.om-top{display:flex;justify-content:space-between;padding:8px 12px;font:600 14px system-ui,sans-serif}
.om-lives{letter-spacing:2px;color:#ff7a7a}
.om-field{position:relative;flex:1;margin:0 8px}
.om-zone{position:absolute;left:0;right:0;top:30%;border-top:2px dashed rgba(255,255,255,.2)}
.om-pill{position:absolute;width:44px;height:44px;margin-left:-22px;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:24px;color:#14151a;border:3px solid #fff;box-shadow:0 0 12px rgba(255,255,255,.4)}
.om-msg{position:absolute;left:0;right:0;top:12%;text-align:center;font:700 18px var(--comic,system-ui);pointer-events:none;opacity:0;transition:opacity .2s}
.om-msg.on{opacity:1}
.om-trays{display:flex;gap:8px;padding:8px}
.om-tray{flex:1;min-height:76px;border-radius:12px;border:3px solid var(--c);background:rgba(255,255,255,.06);color:var(--c);font:700 30px system-ui;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.om-tray small{font:600 12px system-ui;color:#eef2f7}
.om-tray:active,.om-tray:focus-visible{background:var(--c);color:#14151a;outline:none}
.om-tray:active small,.om-tray:focus-visible small{color:#14151a}
.om-hint{text-align:center;font:12px system-ui;opacity:.7;padding-bottom:6px}
.om.shake{animation:om-shake .25s}
@keyframes om-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.om.rm,.om.rm *{animation:none!important;transition:none!important}
`;

export function start(root, ctx) {
  const L = ctx.lang === "id" ? "id" : "en";
  const X = TEXT[L];
  if (!document.getElementById("css-night-meds")) {
    const s = document.createElement("style");
    s.id = "css-night-meds";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  root.innerHTML = `<div class="om${ctx.reduceMotion ? " rm" : ""}"><div class="om-top"><span class="om-score"></span><span class="om-streak"></span><span class="om-lives" aria-live="polite"></span></div>
<div class="om-field"><div class="om-zone"></div><div class="om-pill" role="img"></div><div class="om-msg" aria-live="assertive"></div></div>
<div class="om-trays">${COLORS.map((c, i) => `<button type="button" class="om-tray" style="--c:${c}" data-i="${i}" aria-label="${X.tray[i]}" aria-keyshortcuts="${i + 1}">${SHAPES[i]}<small>${i + 1}</small></button>`).join("")}</div>
<div class="om-hint">${X.hint}</div></div>`;
  const $ = (q) => root.querySelector(q);
  const box = $(".om"), pillEl = $(".om-pill"), msg = $(".om-msg"), field = $(".om-field");
  let eng, raf = 0, last = 0, reported = false, msgTimer = 0, dead = false, n = 0;

  const say = (text) => {
    msg.textContent = text; msg.classList.add("on");
    clearTimeout(msgTimer); msgTimer = setTimeout(() => msg.classList.remove("on"), 600);
  };
  const hud = () => {
    const s = eng.state();
    $(".om-score").textContent = `${X.score} ${s.score}`;
    $(".om-streak").textContent = s.streak >= 2 ? X.streak(s.streak) : "";
    $(".om-lives").textContent = "♥".repeat(Math.max(0, s.lives)) + "♡".repeat(Math.max(0, LIVES - s.lives));
    $(".om-lives").setAttribute("aria-label", X.lives(Math.max(0, s.lives)));
  };
  const shake = () => { if (ctx.reduceMotion) return; box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); };
  const finish = () => {
    if (reported) return;
    reported = true;
    cancelAnimationFrame(raf);
    ctx.onOver(eng.state().score);
  };
  const react = (events) => {
    for (const e of events) {
      if (e.type === "ok") say(e.streak >= 5 ? `${X.streak(e.streak)} +${e.gain}` : X.ok[n++ % X.ok.length]);
      else if (e.type === "wrong") { say(X.bad); shake(); }
      else if (e.type === "miss") { say(X.miss); shake(); }
      else if (e.type === "spawn") { pillEl.style.background = COLORS[e.kind]; pillEl.textContent = SHAPES[e.kind]; pillEl.setAttribute("aria-label", X.pill[e.kind]); }
      else if (e.type === "over") finish();
    }
    hud();
  };
  const draw = () => {
    const p = eng.state().pill;
    pillEl.style.display = p ? "flex" : "none";
    if (p) {
      pillEl.style.left = "50%";
      pillEl.style.top = `${p.p * (field.clientHeight - 44)}px`;
    }
  };
  const frame = (now) => {
    if (dead || reported) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    react(eng.tick(dt));
    draw();
    if (!reported) raf = requestAnimationFrame(frame);
  };
  const pick = (i) => { if (!reported) { react(eng.choose(i)); draw(); } };
  const onClick = (ev) => { const b = ev.target.closest(".om-tray"); if (b) pick(+b.dataset.i); };
  const onKey = (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const i = { "1": 0, "2": 1, "3": 2, ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2 }[ev.key];
    if (i === undefined) return;
    ev.preventDefault();
    pick(i);
  };
  root.addEventListener("pointerdown", (ev) => { if (ev.target.closest(".om-tray")) { ev.preventDefault(); onClick(ev); } });
  root.addEventListener("click", (ev) => { if (ev.detail === 0) onClick(ev); }); // keyboard activation of a focused button
  document.addEventListener("keydown", onKey);

  function restart() {
    cancelAnimationFrame(raf);
    eng = createEngine();
    reported = false; n = 0; last = performance.now();
    msg.classList.remove("on");
    hud(); draw();
    raf = requestAnimationFrame(frame);
  }
  restart();
  return {
    restart,
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      clearTimeout(msgTimer);
      document.removeEventListener("keydown", onKey);
      root.innerHTML = "";
    },
  };
}
