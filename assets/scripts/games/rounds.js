// Night Rounds: rooms light up on a night shift; tap each one before its timer runs out.
// A call answered in time scores 10 (15 if answered in the first half of the time). A call that runs out costs one of
// three "missed calls". Calls come faster, several at once, and with less time the longer the shift lasts.
// The rules (createEngine) know nothing about the page, so they can be tested alone; startRounds adds the buttons.
// The markup (six buttons .room, #mStatus, #sighs, #mStart) is made by tools/make_site.py.

const ROOMS = 6;
const LIVES = 3;
const TICK_MS = 50;

export function createEngine({ rooms = ROOMS, rng = Math.random, lives = LIVES } = {}) {
  const st = {
    t: 0, score: 0, lives, over: false, nextAt: 0.8,
    rooms: Array.from({ length: rooms }, () => ({ lit: false, deadline: 0, window: 0 })),
  };
  const windowAt = (t) => Math.max(1.2, 3.0 - t * 0.03);  // seconds a call waits
  const maxLitAt = (t) => (t < 20 ? 1 : t < 45 ? 2 : 3);  // calls at the same time
  const gapAt = (t) => Math.max(0.45, 1.3 - t * 0.012);   // seconds between calls

  // Move time forward by dt seconds. Returns what happened: {type: "lit"|"miss"|"over", i?, window?}
  function tick(dt) {
    const events = [];
    if (st.over) return events;
    st.t += dt;
    st.rooms.forEach((r, i) => {
      if (st.over || !r.lit || st.t < r.deadline) return;
      r.lit = false;
      st.lives -= 1;
      events.push({ type: "miss", i });
      if (st.lives <= 0) {
        st.over = true;
        events.push({ type: "over" });
      }
    });
    if (st.over) return events;
    const litCount = st.rooms.filter((r) => r.lit).length;
    if (st.t >= st.nextAt && litCount < maxLitAt(st.t)) {
      const free = st.rooms.map((r, i) => (r.lit ? -1 : i)).filter((i) => i >= 0);
      const i = free[Math.floor(rng() * free.length)];
      const window = windowAt(st.t);
      st.rooms[i] = { lit: true, deadline: st.t + window, window };
      events.push({ type: "lit", i, window });
      st.nextAt = st.t + gapAt(st.t) * (0.7 + rng() * 0.6);
    }
    return events;
  }

  // Tap a room. Tapping a quiet room costs nothing.
  function tap(i) {
    const r = st.rooms[i];
    if (st.over || !r) return [];
    if (!r.lit) return [{ type: "idle", i }];
    const left = (r.deadline - st.t) / r.window;
    r.lit = false;
    const gain = 10 + (left > 0.5 ? 5 : 0);
    st.score += gain;
    return [{ type: "ok", i, gain }];
  }

  return { tick, tap, state: () => st };
}

// Starts the game in `root` (the .play element). Returns { restart, destroy }.
//   text   { begin, calling, thanks, missed, lives(n), room(i) } words in the visitor's language
//   onOver called with the final score
export function startRounds(root, { text, onOver, rng = Math.random }) {
  const buttons = [...root.querySelectorAll(".room")];
  const status = root.querySelector("#mStatus");
  const livesEl = root.querySelector("#sighs");
  const startBtn = root.querySelector("#mStart");
  let engine = null;
  let timer = 0;
  let last = 0;
  let calmAt = 0;

  buttons.forEach((b, i) => b.setAttribute("aria-label", text.room(i + 1)));
  startBtn.textContent = text.begin;

  const say = (s) => { status.textContent = s; };
  const showLives = () => { livesEl.textContent = text.lives(engine.state().lives); livesEl.dataset.left = engine.state().lives; };

  function paint() {
    const st = engine.state();
    buttons.forEach((b, i) => {
      const r = st.rooms[i];
      b.classList.toggle("lit", r.lit);
      b.style.setProperty("--left", r.lit ? Math.max(0, (r.deadline - st.t) / r.window).toFixed(3) : "0");
    });
  }

  function flash(i, cls) {
    buttons[i].classList.add(cls);
    setTimeout(() => buttons[i].classList.remove(cls), 450);
  }

  function handle(events) {
    for (const e of events) {
      if (e.type === "ok") { flash(e.i, "ok"); say(text.thanks); calmAt = engine.state().t + 1.5; }
      if (e.type === "miss") { flash(e.i, "missed"); say(text.missed); showLives(); calmAt = engine.state().t + 1.5; }
      if (e.type === "idle") flash(e.i, "idle");
      if (e.type === "over") { stop(); paint(); onOver(engine.state().score); }
    }
  }

  function loop() {
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000); // a paused tab must not cost lives
    last = now;
    handle(engine.tick(dt));
    if (engine) {
      paint();
      if (!engine.state().over && engine.state().t > calmAt && status.textContent !== text.calling) say(text.calling);
    }
  }

  function stop() { clearInterval(timer); timer = 0; buttons.forEach((b) => { b.disabled = true; }); }

  function begin() {
    stop();
    engine = createEngine({ rng });
    startBtn.hidden = true;
    buttons.forEach((b) => { b.disabled = false; b.classList.remove("lit", "ok", "missed", "idle"); });
    showLives();
    say(text.calling);
    calmAt = 0;
    last = performance.now();
    timer = setInterval(loop, TICK_MS);
  }

  const tap = (i) => { if (engine && timer) handle(engine.tap(i)); };
  buttons.forEach((b, i) => b.addEventListener("click", () => tap(i)));
  const onKey = (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key >= "1" && e.key <= String(buttons.length)) tap(Number(e.key) - 1);
  };
  window.addEventListener("keydown", onKey);
  startBtn.addEventListener("click", begin);
  buttons.forEach((b) => { b.disabled = true; });
  say("");

  return {
    restart() { begin(); },
    destroy() { stop(); window.removeEventListener("keydown", onKey); },
  };
}
