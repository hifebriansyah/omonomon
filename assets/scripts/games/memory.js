// Quiet Wish: a slow memory game. Four petals glow in an order; repeat it. The order grows by one each round.
// There is no timer. A wrong petal costs one "sigh" and the same order is shown again; after three sighs it is time to rest.
// Score: a finished round of length n+1 adds 5 x n points (round 1 = 5, round 2 = 10, ...), so 5 rounds = 75.
// The markup (four buttons .petal, #mStatus, #sighs, #mStart) is made by tools/make_site.py.

const SIGHS = 3;
const SHOW_MS = 550;   // how long a petal glows while it is shown
const GAP_MS = 250;    // dark moment between two petals
const START_LENGTH = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Starts the game in `root` (the .play element). Returns { restart, destroy }.
//   text   { watch, yourTurn, wellDone, sigh, begin, sighs(n), petal(i) } words in the visitor's language
//   onOver called with the final score
export function startMemory(root, { text, onOver }) {
  const petals = [...root.querySelectorAll(".petal")];
  const status = root.querySelector("#mStatus");
  const sighsEl = root.querySelector("#sighs");
  const startBtn = root.querySelector("#mStart");

  let run = 0;          // bumped on restart/destroy so an old round stops quietly
  let phase = "idle";   // idle | show | input | busy | over
  let seq = [];
  let pos = 0;
  let round = 1;
  let score = 0;
  let sighsLeft = SIGHS;

  petals.forEach((p, i) => p.setAttribute("aria-label", text.petal(i + 1)));
  startBtn.textContent = text.begin;

  const say = (s) => { status.textContent = s; };
  const showSighs = () => { sighsEl.textContent = text.sighs(sighsLeft); sighsEl.dataset.left = sighsLeft; };
  const setLocked = (locked) => petals.forEach((p) => { p.disabled = locked; });

  async function glow(i, ms = SHOW_MS) {
    petals[i].classList.add("on");
    await sleep(ms);
    petals[i].classList.remove("on");
  }

  async function playSequence(id) {
    phase = "show";
    setLocked(true);
    say(text.watch);
    await sleep(600);
    for (const i of seq) {
      if (id !== run) return;
      await glow(i);
      await sleep(GAP_MS);
    }
    if (id !== run) return;
    pos = 0;
    phase = "input";
    setLocked(false);
    say(text.yourTurn);
  }

  async function press(i) {
    if (phase !== "input") return;
    const id = run;
    if (i === seq[pos]) {
      glow(i, 280);
      pos += 1;
      if (pos === seq.length) {
        phase = "busy";
        setLocked(true);
        score += (seq.length - 1) * 5;
        say(text.wellDone);
        await sleep(1000);
        if (id !== run) return;
        round += 1;
        seq.push(Math.floor(Math.random() * 4));
        await playSequence(id);
      }
      return;
    }
    // a wrong petal: one sigh, then the same order again
    phase = "busy";
    setLocked(true);
    petals[i].classList.add("wrong");
    sighsLeft -= 1;
    showSighs();
    await sleep(700);
    petals[i].classList.remove("wrong");
    if (id !== run) return;
    if (sighsLeft <= 0) {
      phase = "over";
      say("");
      onOver(score);
      return;
    }
    say(text.sigh);
    await sleep(900);
    if (id !== run) return;
    await playSequence(id);
  }

  function begin() {
    run += 1;
    seq = Array.from({ length: START_LENGTH }, () => Math.floor(Math.random() * 4));
    round = 1;
    score = 0;
    sighsLeft = SIGHS;
    pos = 0;
    startBtn.hidden = true;
    showSighs();
    petals.forEach((p) => p.classList.remove("on", "wrong"));
    playSequence(run);
  }

  petals.forEach((p, i) => p.addEventListener("click", () => press(i)));
  const onKey = (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key >= "1" && e.key <= "4") press(Number(e.key) - 1);
  };
  window.addEventListener("keydown", onKey);
  startBtn.addEventListener("click", begin);
  setLocked(true);
  say("");

  return {
    restart() { begin(); },
    destroy() { run += 1; window.removeEventListener("keydown", onKey); },
  };
}
