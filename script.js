// Pocowomon: pure JSON-driven, no AI.
// The library is sharded by build.py. A message only downloads the few small
// shards its words hash into, plus one reply chunk for the winning rule.
const BASE = "data/";
const MAX_WORDS = 40; // cap how many shards one message can pull

const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");

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
    lastLang = lang || manifest.defaultLang;
    return pick(manifest.languages[lastLang].fallback);
  }
  const best = pick(ties);
  lastLang = best.lang;
  const chunk = await load(`replies/${Math.floor(best.id / manifest.chunkSize)}.json`);
  return pick(chunk[best.id % manifest.chunkSize]);
}

function addMessage(text, who) {
  const el = document.createElement("div");
  el.className = `msg ${who}`;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

async function botReply(text) {
  const typing = addMessage("Pocowomon is sighing...", "bot typing");
  const delay = new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
  let reply;
  try {
    reply = await findReply(text);
  } catch (err) {
    reply = `My memory slipped away (${err.message}).`;
  }
  await delay;
  typing.remove();
  addMessage(reply, "bot");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !manifest) return;
  addMessage(text, "user");
  input.value = "";
  botReply(text);
});

async function init() {
  try {
    const res = await fetch(`${BASE}manifest.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = await res.json();
    // Greet in the browser's language when we support it.
    const browser = (navigator.language || "").slice(0, 2);
    lastLang = manifest.langs.includes(browser) ? browser : manifest.defaultLang;
    addMessage(manifest.languages[lastLang].greeting, "bot");
  } catch (err) {
    addMessage(
      `Even my memory is gone (${err.message}). Run "python3 build.py", then serve this folder over http, e.g. "python3 -m http.server".`,
      "bot"
    );
  }
}

init();
