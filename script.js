// Ghost Chat: pick a character and talk to them.
// Replies come from Gemini (via the Worker). Pocomon also has a sharded JSON
// rule library as backup; the other characters fall back to a few in-character lines.
// Crisis phrases are always answered by the local safety rule and never sent to Gemini.
const BASE = "data/";
const MAX_WORDS = 40; // cap how many shards one message can pull

const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const pickerEl = document.getElementById("picker");
const nameEl = document.getElementById("name");
const statusEl = document.getElementById("status");
const heroEl = document.getElementById("hero");
const bubbleEl = document.getElementById("bubble");
const bubbleText = document.getElementById("bubbleText");
const youBubble = document.getElementById("youBubble");
const youText = document.getElementById("youText");
const srEl = document.getElementById("sr");
const historyBtn = document.getElementById("historyBtn");
const historyEl = document.getElementById("history");
const countEl = document.getElementById("count");

// Limit message length to save tokens. The Worker enforces its own cap too.
const MAX_INPUT = window.POCO_CONFIG.INPUT_MAX_CHARS || 200;
input.maxLength = MAX_INPUT;
function updateCount() {
  const n = input.value.length;
  const show = n >= MAX_INPUT * 0.75;
  countEl.hidden = !show;
  countEl.textContent = `${n}/${MAX_INPUT}`;
  countEl.classList.toggle("full", n >= MAX_INPUT);
  input.parentElement.classList.toggle("counting", show);
}
input.addEventListener("input", updateCount);

let manifest;
const cache = new Map(); // path -> Promise of parsed JSON
const encoder = new TextEncoder();

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Keep in sync with normalize() in build.py.
const tokenize = (text) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ").split(/\s+/).filter(Boolean);

// Keep in sync with fnv1a() in build.py.
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const b of encoder.encode(text)) h = Math.imul(h ^ b, 0x01000193);
  return h >>> 0;
}

function load(path) {
  if (!cache.has(path)) {
    const p = fetch(`${BASE}${path}?v=${manifest.version}`).then((res) => {
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json();
    });
    p.catch(() => cache.delete(path)); // allow a retry later
    cache.set(path, p);
  }
  return cache.get(path);
}

// Guess the message language from per-language stopword lists in the manifest.
// No clear signal: stay in whichever language the chat was last in.
let lastLang;
function detectLang(words) {
  let best = lastLang, bestScore = 0, tie = false;
  for (const lang of manifest.langs) {
    const stop = manifest.languages[lang].stopwords;
    const score = words.filter((w) => stop.includes(w)).length;
    if (score > bestScore) { best = lang; bestScore = score; tie = false; }
    else if (score && score === bestScore) tie = true;
  }
  return tie ? lastLang : best;
}

function beats(a, b) {
  if (a.priority !== b.priority) return a.priority > b.priority;
  if (a.same !== b.same) return a.same > b.same;
  return a.len > b.len;
}

// Look the message up in the local rule library.
async function findReply(text) {
  const words = tokenize(text).slice(0, MAX_WORDS);
  const lang = detectLang(words);

  // Every 1..maxGram word window, grouped by the shard it hashes into.
  const byShard = new Map();
  for (let n = 1; n <= manifest.maxGram; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n).join(" ");
      const shard = fnv1a(gram) % manifest.shards;
      if (!byShard.has(shard)) byShard.set(shard, new Set());
      byShard.get(shard).add(gram);
    }
  }

  const shards = await Promise.all(
    [...byShard.keys()].map((s) => load(`shards/${s}.json`))
  );

  // Higher priority wins, then a rule in the message's language, then the
  // longer phrase. Rules that tie on all three share the turn at random.
  let ties = [];
  [...byShard.values()].forEach((grams, k) => {
    for (const gram of grams) {
      const entries = shards[k][gram];
      if (!entries) continue;
      const len = gram.split(" ").length;
      for (const [id, priority, li] of entries) {
        const cand = { id, priority, len, lang: manifest.langs[li] };
        cand.same = cand.lang === lang ? 1 : 0;
        if (!ties.length || beats(cand, ties[0])) ties = [cand];
        else if (!beats(ties[0], cand) && !ties.some((t) => t.id === id)) ties.push(cand);
      }
    }
  });

  if (!ties.length) {
    return { reply: pick(manifest.languages[lang || manifest.defaultLang].fallback), lang, priority: -1 };
  }
  const best = pick(ties);
  const chunk = await load(`replies/${Math.floor(best.id / manifest.chunkSize)}.json`);
  return { reply: pick(chunk[best.id % manifest.chunkSize]), lang: best.lang, priority: best.priority };
}

// Rules at or above this priority (the crisis/safety rules) are never handed to Gemini.
const SAFETY_PRIORITY = 100;

// ---- Characters and per-character chats ----
let characters = [];
let current;                 // selected character object
const logs = {};             // id -> [{who, text}] shown messages
const histories = {};        // id -> [{role: "user" | "model", text}] sent to Gemini

const byId = (id) => characters.find((c) => c.id === id);
const inLang = (obj) => obj?.[lastLang] || obj?.en || "";

// ---- Stage: big character, comic bubbles, optional history ----
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let typeTimer = null;
let shown = "";                 // full text of the bubble being typed
const pending = {};             // character id -> replies still on the way

function stopTyping() {
  clearInterval(typeTimer);
  typeTimer = null;
}

// The bubble gets a fixed share of the stage, so the character never shrinks.
// Long text shrinks to fit that space (down to a minimum, then it scrolls).
const stageEl = document.getElementById("stage");
const FONT_STEPS = [1.15, 1.05, 0.96, 0.88, 0.8, 0.74]; // rem

function layoutBubble() {
  document.documentElement.style.setProperty("--bubble-max", `${Math.round(stageEl.clientHeight * 0.23)}px`);
  if (shown && !bubbleEl.classList.contains("thinking")) fitBubble(shown, true);
}

function fitBubble(text, keepText = false) {
  const current = bubbleText.textContent;
  bubbleText.textContent = text; // measure with the full text, even while it is being typed
  for (const size of FONT_STEPS) {
    bubbleText.style.fontSize = `${size}rem`;
    if (bubbleText.scrollHeight <= bubbleText.clientHeight + 1) break;
  }
  if (keepText) bubbleText.textContent = current;
}
window.addEventListener("resize", layoutBubble);

// Reveal text in the bubble letter by letter. Click the bubble to skip ahead.
function showBubble(text, { instant = false } = {}) {
  stopTyping();
  bubbleEl.classList.remove("thinking");
  shown = text;
  fitBubble(text);
  if (instant || reduceMotion) {
    bubbleText.textContent = text;
    return;
  }
  bubbleText.textContent = "";
  let i = 0;
  typeTimer = setInterval(() => {
    i = Math.min(text.length, i + 2);
    bubbleText.textContent = text.slice(0, i);
    if (i >= text.length) stopTyping();
  }, 22);
}
bubbleEl.addEventListener("click", () => {
  if (typeTimer) { stopTyping(); bubbleText.textContent = shown; }
});

function showThinking() {
  stopTyping();
  bubbleText.style.fontSize = "";
  bubbleEl.classList.add("thinking");
  bubbleText.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
}

function showYou(text) {
  youText.textContent = text;
  youBubble.title = text; // full text on hover; the bubble shows one line
  youBubble.hidden = false;
}

function animateHero(cls) {
  heroEl.classList.remove("talk", "swap");
  void heroEl.offsetWidth; // restart the animation
  heroEl.classList.add(cls);
}

// History overlay: the full log for the open character.
function appendRow(c, who, text) {
  const row = document.createElement("div");
  row.className = `row ${who}`;
  if (who === "bot") {
    const img = document.createElement("img");
    img.className = "mini";
    img.src = c.image;
    img.alt = "";
    row.append(img);
  }
  const msg = document.createElement("div");
  msg.className = `msg ${who}`;
  msg.textContent = text;
  row.append(msg);
  messagesEl.append(row);
}

function renderHistory() {
  messagesEl.replaceChildren();
  for (const m of logs[current.id] || []) appendRow(current, m.who, m.text);
  historyEl.scrollTop = historyEl.scrollHeight;
}

historyBtn.addEventListener("click", () => {
  const open = historyEl.hidden;
  historyEl.hidden = !open;
  historyBtn.setAttribute("aria-expanded", String(open));
  historyBtn.textContent = open ? "Close" : "History";
  if (open) renderHistory();
});

// Record a message for character `id` and show it if that character is on stage.
function say(id, who, text) {
  (logs[id] ||= []).push({ who, text });
  if (current.id !== id) return;
  if (who === "bot") {
    showBubble(text);
    srEl.textContent = text;
    animateHero("talk");
  } else {
    showYou(text);
  }
  if (!historyEl.hidden) {
    appendRow(current, who, text);
    historyEl.scrollTop = historyEl.scrollHeight;
  }
}

function greeting(c) {
  return c.library ? manifest.languages[lastLang].greeting : inLang(c.greeting);
}

function selectCharacter(id) {
  current = byId(id);
  layoutBubble();
  document.documentElement.style.setProperty("--accent", current.accent);
  heroEl.src = current.stage;
  heroEl.alt = current.name;
  nameEl.textContent = current.name;
  statusEl.textContent = current.status;
  input.placeholder = `Say something to ${current.name}...`;
  pickerEl.querySelectorAll("button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.id === id))
  );
  try { localStorage.setItem("character", id); } catch {}

  const fresh = !logs[id];
  if (fresh) logs[id] = [{ who: "bot", text: greeting(current) }];
  const log = logs[id];
  const lastBot = [...log].reverse().find((m) => m.who === "bot");
  const lastUser = [...log].reverse().find((m) => m.who === "user");

  if (lastUser) showYou(lastUser.text);
  else youBubble.hidden = true;
  if (pending[id] > 0) showThinking();
  else showBubble(lastBot.text, { instant: !fresh });
  srEl.textContent = lastBot.text;
  animateHero("swap");
  if (!historyEl.hidden) renderHistory();
  input.focus();
}

function buildPicker() {
  for (const c of characters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = c.id;
    btn.setAttribute("aria-pressed", "false");
    const img = document.createElement("img");
    img.src = c.image;
    img.alt = "";
    btn.append(img, document.createTextNode(c.name));
    btn.addEventListener("click", () => selectCharacter(c.id));
    pickerEl.append(btn);
  }
}

// ---- Replies ----
async function askGemini(c, text) {
  const cfg = window.POCO_CONFIG;
  const history = histories[c.id] ||= [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.TIMEOUT_MS);
  try {
    const res = await fetch(cfg.WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character: c.id,
        messages: [...history.slice(-cfg.HISTORY_TURNS), { role: "user", text }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { reply } = await res.json();
    if (typeof reply !== "string" || !reply.trim()) throw new Error("empty reply");
    return reply.trim();
  } finally {
    clearTimeout(timer);
  }
}

// Order: local safety rule, then Gemini, then this character's backup replies.
async function getReply(c, text) {
  // The local lookup should never block a reply: retry once, then carry on without it.
  let local;
  for (let attempt = 0; attempt < 2 && !local; attempt++) {
    try {
      local = await findReply(text);
    } catch (err) {
      console.warn("Local rule lookup failed:", err.message);
    }
  }
  local ||= { reply: pick(manifest.languages[lastLang || manifest.defaultLang].fallback), priority: -1 };
  if (local.lang) lastLang = local.lang;

  let reply;
  if (local.priority >= SAFETY_PRIORITY) {
    reply = local.reply;
  } else {
    if (window.POCO_CONFIG.WORKER_URL) {
      try {
        reply = await askGemini(c, text);
      } catch (err) {
        console.warn("Gemini unavailable, using backup replies:", err.message);
      }
    }
    if (!reply) reply = c.library ? local.reply : pick(c.fallback[lastLang] || c.fallback.en);
  }
  (histories[c.id] ||= []).push({ role: "user", text }, { role: "model", text: reply });
  return reply;
}

async function botReply(c, text) {
  pending[c.id] = (pending[c.id] || 0) + 1;
  if (current.id === c.id) showThinking();
  const delay = new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
  let reply;
  try {
    reply = await getReply(c, text);
  } catch (err) {
    reply = `Something went wrong (${err.message}).`;
  }
  await delay;
  pending[c.id]--;
  say(c.id, "bot", reply);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim().slice(0, MAX_INPUT);
  if (!text || !manifest || !current) return;
  say(current.id, "user", text);
  input.value = "";
  updateCount();
  botReply(current, text);
});

async function init() {
  try {
    const [m, c] = await Promise.all([
      fetch(`${BASE}manifest.json`).then((r) => { if (!r.ok) throw new Error(`manifest HTTP ${r.status}`); return r.json(); }),
      fetch("characters.json").then((r) => { if (!r.ok) throw new Error(`characters HTTP ${r.status}`); return r.json(); }),
    ]);
    manifest = m;
    characters = c.characters;
    // Greet in the browser's language when we support it.
    const browser = (navigator.language || "").slice(0, 2);
    lastLang = manifest.langs.includes(browser) ? browser : manifest.defaultLang;

    let start = c.default;
    try { start = localStorage.getItem("character") || start; } catch {}
    buildPicker();
    selectCharacter(byId(start) ? start : c.default);
  } catch (err) {
    bubbleText.textContent =
      `Could not start (${err.message}). Run "python3 build.py", then serve this folder over http, e.g. "python3 -m http.server".`;
  }
}

init();
