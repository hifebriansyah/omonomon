// The local rule library (builds/data/, made by build.py): look a message up in the shards.
// Used for crisis phrases (always) and as Pocomon's backup replies.

import { state } from "./state.js";
import { pick, tokenize, fnv1a } from "./util.js";

export const DATA_BASE = "builds/data/";
const MAX_WORDS = 40; // cap how many shards one message can pull

const cache = new Map(); // path -> Promise of parsed JSON

function load(path) {
  if (!cache.has(path)) {
    const p = fetch(`${DATA_BASE}${path}?v=${state.manifest.version}`).then((res) => {
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
function detectLang(words) {
  const { manifest, lastLang } = state;
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

// Returns { reply, lang, priority }. priority -1 means "no rule matched".
export async function findReply(text) {
  const { manifest } = state;
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
