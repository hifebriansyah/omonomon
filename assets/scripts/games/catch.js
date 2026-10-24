// Hair Catch: slide left and right to catch falling secrets with the ghost's hair, and dodge the dark ones.
// A secret is worth 10 points (a streak of 5 or more adds 5 each). A dark one costs a life; three lives.
// Drawn on one canvas (480x270 logical pixels, scaled to the screen), like Hop Hop.

const W = 480;
const H = 270;
const GROUND = H - 8;
const HERO_H = 82;
const LIVES = 3;
const KEY_SPEED = 300; // px/s with the arrow keys
const STARS = Array.from({ length: 30 }, (_, i) => ({ x: (i * 89) % W, y: 10 + ((i * 47) % 150), r: i % 4 === 0 ? 1.6 : 1 }));

// Starts the game on `canvas`. Returns { restart, destroy, peek }.
//   hero      loaded <img> of the character
//   accent    the character's colour
//   best      best score so far (shown on screen)
//   onOver    called with the final score
//   startText what the start screen says
//   peek()    a snapshot of the state (for tests)
export function startCatch(canvas, { hero, accent, best, onOver, startText, rng = Math.random }) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const heroW = HERO_H * ((hero.naturalWidth || 1) / (hero.naturalHeight || 1));
  const catchW = Math.max(heroW * 0.95, 56);
  const catchTop = GROUND - HERO_H + 2;     // the hair: the top of the picture
  const catchBottom = catchTop + 30;
  let s;
  let raf = 0;
  let last = 0;
  let destroyed = false;
  let bestShown = best;
  const keys = { left: false, right: false };

  function reset() {
    s = { state: "ready", time: 0, x: W / 2, targetX: W / 2, vx: 0, items: [], spawnIn: 0.7, score: 0, lives: LIVES, streak: 0, flash: 0, pop: [] };
  }

  const clampX = (x) => Math.max(catchW / 2, Math.min(W - catchW / 2, x));
  const toLogical = (clientX) => {
    const r = canvas.getBoundingClientRect();
    return clampX(((clientX - r.left) / (r.width || W)) * W);
  };
  const start = () => { if (s.state === "ready") s.state = "running"; };

  function update(dt) {
    if (s.state !== "running") return;
    s.time += dt;
    s.flash = Math.max(0, s.flash - dt);
    if (keys.left) s.targetX = clampX(s.targetX - KEY_SPEED * dt);
    if (keys.right) s.targetX = clampX(s.targetX + KEY_SPEED * dt);
    const before = s.x;
    s.x += (s.targetX - s.x) * Math.min(1, 16 * dt);
    s.vx = (s.x - before) / (dt || 1);

    // it gets faster and darker the longer you last
    const fall = Math.min(250, 95 + s.time * 3.2);
    const darkShare = Math.min(0.45, 0.18 + s.time * 0.005);
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      s.items.push({ x: 18 + rng() * (W - 36), y: -14, vy: fall * (0.9 + rng() * 0.2), dark: rng() < darkShare, spin: rng() * 6 });
      s.spawnIn = Math.max(0.38, 0.85 - s.time * 0.008) * (0.75 + rng() * 0.5);
    }
    for (const it of s.items) { it.y += it.vy * dt; it.spin += dt * 3; }

    const left = s.x - catchW / 2;
    const right = s.x + catchW / 2;
    const keep = [];
    for (const it of s.items) {
      const inReach = it.y + 12 >= catchTop && it.y - 12 <= catchBottom && it.x >= left - 6 && it.x <= right + 6;
      if (inReach) {
        if (it.dark) {
          s.lives -= 1;
          s.streak = 0;
          s.flash = 0.35;
          s.pop.push({ x: it.x, y: it.y, text: "-1", t: 0.8, dark: true });
          if (s.lives <= 0) { s.state = "over"; onOver(s.score); return; }
        } else {
          s.streak += 1;
          const gain = s.streak >= 5 ? 15 : 10;
          s.score += gain;
          s.pop.push({ x: it.x, y: it.y, text: `+${gain}`, t: 0.8 });
        }
      } else if (it.y - 14 > H) {
        if (!it.dark) s.streak = 0; // a secret that got away breaks the streak
      } else {
        keep.push(it);
      }
    }
    s.items = keep;
    s.pop = s.pop.map((p) => ({ ...p, t: p.t - dt, y: p.y - 30 * dt })).filter((p) => p.t > 0);
  }

  // ---- drawing ----

  function drawItem(it) {
    ctx.save();
    ctx.translate(it.x, it.y);
    if (it.dark) {
      ctx.rotate(it.spin);
      ctx.fillStyle = "#1a1328";
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? 8 : 14;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#7a4bd6";
      ctx.stroke();
      ctx.rotate(-it.spin);
      ctx.fillStyle = "#ff5a5a";
      ctx.fillRect(-5, -3, 3, 3);
      ctx.fillRect(2, -3, 3, 3);
    } else {
      ctx.shadowColor = "#ffe08a";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#fff2c2";
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#14151a";
      ctx.stroke();
      ctx.fillStyle = "#14151a";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("?", 0, 5);
    }
    ctx.restore();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0f1f1a");
    sky.addColorStop(1, "#1d4a38");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.7)";
    for (const st of STARS) {
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#102a20"; // ground
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = accent;
    ctx.fillRect(0, GROUND, W, 2);

    s.items.forEach(drawItem);

    // the ghost, leaning a little the way she moves; a red flash when a dark one got her
    ctx.save();
    ctx.translate(s.x, GROUND);
    ctx.rotate(Math.max(-0.18, Math.min(0.18, s.vx / 2200)));
    ctx.drawImage(hero, -heroW / 2, -HERO_H, heroW, HERO_H);
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 60, ${s.flash})`;
      ctx.fillRect(-heroW / 2, -HERO_H, heroW, HERO_H);
    }
    ctx.restore();

    ctx.font = "bold 14px system-ui, sans-serif";
    for (const p of s.pop) {
      ctx.fillStyle = p.dark ? "#ff8a8a" : "#ffe08a";
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(String(s.score), 12, 24);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff8a9a";
    ctx.fillText("♥".repeat(Math.max(0, s.lives)), W - 12, 24);
    if (bestShown) {
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText(String(Math.max(bestShown, s.score)), W - 12, 42);
    }
    if (s.state === "ready") {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 17px system-ui, sans-serif";
      ctx.fillText(startText, W / 2, 110);
    }
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - (last || now)) / 1000);
    last = now;
    update(dt);
    draw();
    if (!destroyed) raf = requestAnimationFrame(frame);
  }

  // ---- input: finger or mouse follows, arrow keys / A and D move ----
  const onMove = (e) => { s.targetX = toLogical(e.clientX); };
  const onDown = (e) => { e.preventDefault(); canvas.focus({ preventScroll: true }); s.targetX = toLogical(e.clientX); start(); };
  const keyName = (e) => (e.code === "ArrowLeft" || e.code === "KeyA" ? "left" : e.code === "ArrowRight" || e.code === "KeyD" ? "right" : e.code === "Space" ? "start" : null);
  const onKeyDown = (e) => {
    if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return; // let buttons work
    const k = keyName(e);
    if (!k) return;
    e.preventDefault();
    if (k === "start") start();
    else { keys[k] = true; start(); }
  };
  const onKeyUp = (e) => { const k = keyName(e); if (k === "left" || k === "right") keys[k] = false; };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  reset();
  raf = requestAnimationFrame(frame);

  return {
    restart(newBest) {
      bestShown = newBest;
      keys.left = keys.right = false;
      reset();
      canvas.focus({ preventScroll: true });
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    peek: () => ({ state: s.state, x: s.x, score: s.score, lives: s.lives, items: s.items.map((i) => ({ x: i.x, y: i.y, dark: i.dark })) }),
  };
}
