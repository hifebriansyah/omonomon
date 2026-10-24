// Gosip Pohon: secrets peek out of a tree; tap them before they hide. Crows and bats cost a life (3 lives).
// createEngine holds the rules and knows nothing about the page. start() builds the buttons.

const SPOTS = 9;
const LIVES = 3;
const TICK_MS = 50;

export function createEngine({ spots = SPOTS, rng = Math.random, lives = LIVES } = {}) {
  const st = {
    t: 0, score: 0, lives, streak: 0, over: false, nextAt: 0.6,
    spots: Array.from({ length: spots }, () => ({ kind: null, deadline: 0, window: 0 })),
  };
  const windowAt = (t) => Math.max(0.7, 1.9 - t * 0.02);   // seconds a peeker stays out
  const maxUpAt = (t) => (t < 15 ? 1 : t < 35 ? 2 : t < 60 ? 3 : 4); // peekers at once
  const gapAt = (t) => Math.max(0.35, 1.0 - t * 0.01);     // seconds between peekers
  const decoyAt = (t) => Math.min(0.35, 0.2 + t * 0.003);  // chance a peeker is a decoy

  // Move time forward by dt seconds. Events: {type:"show",i,kind,window} | {type:"hide",i,kind} | {type:"over"}
  function tick(dt) {
    const events = [];
    if (st.over) return events;
    st.t += dt;
    st.spots.forEach((s, i) => {
      if (!s.kind || st.t < s.deadline) return;
      const kind = s.kind;
      s.kind = null;
      if (kind === "secret") st.streak = 0;
      events.push({ type: "hide", i, kind });
    });
    const up = st.spots.filter((s) => s.kind).length;
    if (st.t >= st.nextAt && up < maxUpAt(st.t)) {
      const free = st.spots.map((s, i) => (s.kind ? -1 : i)).filter((i) => i >= 0);
      const i = free[Math.floor(rng() * free.length)];
      const kind = rng() < decoyAt(st.t) ? (rng() < 0.5 ? "crow" : "bat") : "secret";
      const window = windowAt(st.t);
      st.spots[i] = { kind, deadline: st.t + window, window };
      events.push({ type: "show", i, kind, window });
      st.nextAt = st.t + gapAt(st.t) * (0.7 + rng() * 0.6);
    }
    return events;
  }

  // Tap a spot. An empty spot costs nothing.
  function tap(i) {
    const s = st.spots[i];
    if (st.over || !s) return [];
    if (!s.kind) return [{ type: "idle", i }];
    const kind = s.kind;
    s.kind = null;
    if (kind === "secret") {
      st.streak += 1;
      const gain = st.streak >= 5 ? 15 : 10;
      st.score += gain;
      return [{ type: "ok", i, gain, streak: st.streak }];
    }
    st.streak = 0;
    st.lives -= 1;
    const events = [{ type: "bad", i, kind }];
    if (st.lives <= 0) {
      st.over = true;
      events.push({ type: "over" });
    }
    return events;
  }

  return { tick, tap, state: () => st };
}

const TEXT = {
  en: {
    score: "Secrets", lives: (n) => "Lives: " + "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, LIVES - n)),
    spot: (n) => "Branch " + n, secret: "secret", crow: "crow", bat: "bat", empty: "empty",
    begin: "Tap the secrets as they peek out!", streak: (n) => "Streak x" + n, oops: "Oops, a decoy!",
    again: "Play again",
  },
  id: {
    score: "Rahasia", lives: (n) => "Nyawa: " + "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, LIVES - n)),
    spot: (n) => "Dahan " + n, secret: "rahasia", crow: "gagak", bat: "kelelawar", empty: "kosong",
    begin: "Tap rahasia yang mengintip!", streak: (n) => "Beruntun x" + n, oops: "Ups, itu umpan!",
    again: "Main lagi",
  },
};

const ICON = { secret: "✉", crow: "🐦‍⬛", bat: "🦇" };

const CSS = `
.gp{display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;padding:10px;box-sizing:border-box;user-select:none;-webkit-user-select:none}
.gp-bar{display:flex;justify-content:space-between;width:100%;max-width:340px;font-family:var(--comic,inherit);font-size:15px}
.gp-msg{min-height:20px;font-size:13px;opacity:.85;text-align:center}
.gp-tree{position:relative;width:min(340px,100%);flex:1;min-height:260px;max-height:380px}
.gp-trunk{position:absolute;left:41%;bottom:0;width:18%;height:34%;background:#5b3a22;border-radius:8px 8px 0 0}
.gp-crown{position:absolute;inset:0 0 22% 0;background:#2f6b3a;border-radius:46% 46% 40% 40%;box-shadow:inset 0 -10px 0 #25562e}
.gp-grid{position:absolute;inset:7% 11% 29% 11%;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:8%}
.gp-spot{position:relative;border:0;border-radius:50%;background:#1d3d23;box-shadow:inset 0 4px 8px #000a;font-size:26px;cursor:pointer;padding:0;color:#fff;overflow:hidden}
.gp-spot:focus-visible{outline:3px solid var(--accent,#fc0)}
.gp-spot i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;transform:translateY(100%);transition:transform .12s}
.gp-spot[data-k] i{transform:none}
.gp-spot[data-k=secret]{background:#26482c;box-shadow:0 0 14px 2px var(--accent,#fc0)}
.gp-spot[data-k=secret] i{text-shadow:0 0 8px var(--accent,#fc0)}
.gp-spot b{position:absolute;left:5px;top:2px;font-size:10px;opacity:.6;font-weight:400}
.gp-spot.hit{background:#5a9a4a}.gp-spot.bad{background:#a33}
.gp-reduce .gp-spot i{transition:none}
.gp-again{display:none;padding:8px 16px;font-size:15px}
`;

export function start(root, ctx = {}) {
  const lang = ctx.lang === "id" ? "id" : "en";
  const X = TEXT[lang];
  if (!document.getElementById("css-tree-gossip")) {
    const style = document.createElement("style");
    style.id = "css-tree-gossip";
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  root.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "gp" + (ctx.reduceMotion ? " gp-reduce" : "");
  wrap.innerHTML =
    '<div class="gp-bar"><span class="gp-score" aria-live="polite"></span><span class="gp-lives"></span></div>' +
    '<div class="gp-msg" role="status"></div><div class="gp-tree"><div class="gp-trunk"></div><div class="gp-crown"></div><div class="gp-grid"></div></div>';
  root.appendChild(wrap);
  const scoreEl = wrap.querySelector(".gp-score");
  const livesEl = wrap.querySelector(".gp-lives");
  const msg = wrap.querySelector(".gp-msg");
  const grid = wrap.querySelector(".gp-grid");
  const buttons = Array.from({ length: SPOTS }, (_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gp-spot";
    b.innerHTML = "<b>" + (i + 1) + "</b><i></i>";
    b.setAttribute("aria-label", X.spot(i + 1) + ", " + X.empty);
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); press(i); });
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(i); } });
    grid.appendChild(b);
    return b;
  });

  let engine = null;
  let timer = 0;
  let last = 0;
  let reported = false;
  let alive = true;

  const flash = (i, cls) => {
    buttons[i].classList.add(cls);
    setTimeout(() => buttons[i] && buttons[i].classList.remove(cls), 160);
  };
  const paint = (i) => {
    const k = engine.state().spots[i].kind;
    const b = buttons[i];
    if (k) { b.dataset.k = k; b.querySelector("i").textContent = ICON[k]; } else { delete b.dataset.k; }
    b.setAttribute("aria-label", X.spot(i + 1) + ", " + (k ? X[k] : X.empty));
  };
  const hud = () => {
    const s = engine.state();
    scoreEl.textContent = X.score + ": " + s.score;
    livesEl.textContent = X.lives(s.lives);
  };
  const finish = () => {
    clearInterval(timer);
    timer = 0;
    if (reported) return;
    reported = true;
    ctx.onOver && ctx.onOver(engine.state().score);
  };
  const handle = (events) => {
    for (const e of events) {
      if (e.type === "show" || e.type === "hide") paint(e.i);
      if (e.type === "ok") { paint(e.i); flash(e.i, "hit"); msg.textContent = e.streak >= 5 ? X.streak(e.streak) : ""; }
      if (e.type === "bad") { paint(e.i); flash(e.i, "bad"); msg.textContent = X.oops; }
      if (e.type === "over") finish();
    }
    hud();
  };
  function press(i) { if (engine && alive) handle(engine.tap(i)); }
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) press(Number(e.key) - 1);
  };
  document.addEventListener("keydown", onKey);

  function run() {
    clearInterval(timer);
    engine = createEngine();
    reported = false;
    buttons.forEach((_, i) => paint(i));
    msg.textContent = X.begin;
    hud();
    last = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      handle(engine.tick(dt));
    }, TICK_MS);
  }
  run();

  return {
    restart() { if (alive) run(); },
    destroy() {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("keydown", onKey);
      root.textContent = "";
    },
  };
}
