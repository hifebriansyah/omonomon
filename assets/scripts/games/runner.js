// Hop Hop: a one-button endless runner. The ghost hops over tombstones; the score is the distance.
// Everything is drawn on one canvas (480x270 logical pixels, scaled to the screen).

const W = 480;
const H = 270;
const GROUND = 212;
const HERO_X = 70;
const HERO_H = 66;
const GRAVITY = 1500;      // px/s^2
const JUMP_SPEED = 520;    // px/s upward: about 90px high, 0.7s in the air
const START_SPEED = 200;   // px/s
const MAX_SPEED = 420;
const SPEEDUP = 8;         // px/s gained every second
const STARS = Array.from({ length: 28 }, (_, i) => ({ x: (i * 97) % W, y: 12 + ((i * 53) % 110), r: i % 3 === 0 ? 1.6 : 1 }));

// Starts the game on `canvas`. Returns { restart, destroy }.
//   hero      loaded <img> of the character
//   accent    the character's colour
//   best      best score so far (shown on screen)
//   onOver    called with the final score
//   startText what the start screen says
export function startRunner(canvas, { hero, accent, best, onOver, startText }) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const heroW = HERO_H * ((hero.naturalWidth || 1) / (hero.naturalHeight || 1));
  let s;
  let raf = 0;
  let last = 0;
  let destroyed = false;
  let bestShown = best;

  function reset() {
    s = { state: "ready", time: 0, dist: 0, speed: START_SPEED, y: 0, vy: 0, obstacles: [], spawnIn: 260, score: 0 };
  }

  function jump() {
    if (s.state === "ready") {
      s.state = "running";
      return;
    }
    if (s.state === "running" && s.y === 0) s.vy = JUMP_SPEED;
  }

  function update(dt) {
    if (s.state !== "running") return;
    s.time += dt;
    s.speed = Math.min(MAX_SPEED, START_SPEED + s.time * SPEEDUP);
    s.dist += s.speed * dt;
    s.score = Math.floor(s.dist / 10);

    s.y = Math.max(0, s.y + s.vy * dt);
    s.vy = s.y === 0 ? 0 : s.vy - GRAVITY * dt;

    s.spawnIn -= s.speed * dt;
    if (s.spawnIn <= 0) {
      const w = 22 + Math.random() * 14;
      const h = 30 + Math.random() * 26;
      s.obstacles.push({ x: W + 20, w, h });
      s.spawnIn = (0.9 + Math.random() * 0.9) * s.speed + 90; // always a jumpable gap
    }
    for (const o of s.obstacles) o.x -= s.speed * dt;
    s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);

    // collision: the ghost's box is a little smaller than the picture
    const left = HERO_X + 12;
    const right = HERO_X + heroW - 12;
    const bottom = GROUND - s.y - 4;
    for (const o of s.obstacles) {
      if (right > o.x + 4 && left < o.x + o.w - 4 && bottom > GROUND - o.h + 4) {
        s.state = "over";
        onOver(s.score);
        return;
      }
    }
  }

  // ---- drawing ----

  function tombstone(o) {
    const top = GROUND - o.h;
    ctx.beginPath();
    ctx.moveTo(o.x, GROUND);
    ctx.lineTo(o.x, top + o.w / 2);
    ctx.arc(o.x + o.w / 2, top + o.w / 2, o.w / 2, Math.PI, 0);
    ctx.lineTo(o.x + o.w, GROUND);
    ctx.closePath();
    ctx.fillStyle = "#9a97ad";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#14151a";
    ctx.stroke();
    ctx.beginPath(); // a small cross
    ctx.moveTo(o.x + o.w / 2, top + 8);
    ctx.lineTo(o.x + o.w / 2, top + 22);
    ctx.moveTo(o.x + o.w / 2 - 5, top + 13);
    ctx.lineTo(o.x + o.w / 2 + 5, top + 13);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#1a1838");
    sky.addColorStop(1, "#3b2a5f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f4efd8"; // moon
    ctx.beginPath();
    ctx.arc(390, 56, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    for (const st of STARS) {
      ctx.beginPath();
      ctx.arc((st.x - s.dist * 0.02 + W * 10) % W, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#2b2146"; // far hills
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, GROUND - 26 - 14 * Math.sin((x + s.dist * 0.15) / 55));
    ctx.lineTo(W, GROUND);
    ctx.fill();

    ctx.fillStyle = "#231a38"; // ground
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = accent;
    ctx.fillRect(0, GROUND, W, 3);
    ctx.fillStyle = "rgba(255,255,255,.18)";
    for (let x = -((s.dist % 40) + 40); x < W; x += 40) ctx.fillRect(x, GROUND + 22, 18, 3);

    s.obstacles.forEach(tombstone);

    // the ghost: a little bob while hopping on the ground, tilted in the air
    const bob = s.state === "running" && s.y === 0 ? Math.abs(Math.sin(s.time * 14)) * 5 : 0;
    ctx.save();
    ctx.translate(HERO_X + heroW / 2, GROUND - s.y - bob);
    ctx.rotate(s.state === "over" ? 0.5 : Math.max(-0.15, Math.min(0.2, -s.vy / 3000)));
    ctx.drawImage(hero, -heroW / 2, -HERO_H, heroW, HERO_H);
    ctx.restore();

    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(String(s.score), 12, 24);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,.65)";
    if (bestShown) ctx.fillText(String(Math.max(bestShown, s.score)), W - 12, 24);

    if (s.state === "ready") {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px system-ui, sans-serif";
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

  // ---- input ----
  const onPointer = (e) => { e.preventDefault(); canvas.focus({ preventScroll: true }); jump(); };
  const onKey = (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return; // let buttons work
      e.preventDefault();
      jump();
    }
  };
  canvas.addEventListener("pointerdown", onPointer);
  window.addEventListener("keydown", onKey);

  reset();
  raf = requestAnimationFrame(frame);

  return {
    restart(newBest) {
      bestShown = newBest;
      reset();
      canvas.focus({ preventScroll: true });
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    },
  };
}
