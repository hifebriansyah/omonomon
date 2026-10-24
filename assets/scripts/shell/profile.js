// A ghost's profile page (/<slug>/profile/): who she is, how close you are, her stories (they unlock with the bond level),
// her latest whispers and her games. The page itself is built by tools/make_site.py; this fills in what depends on the visitor.

import { load, levelProgress } from "../games/progress.js";
import { T, lang } from "../games/text.js";
import { chatTime } from "../time.js";
import { loadMode } from "../storage.js";

const $ = (id) => document.getElementById(id);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

function showBond(c) {
  const { level, pct } = levelProgress(load().bond[c.id] || 0);
  $("profBond").querySelector(".p-bond-label").textContent = `${T.bond} ${level} · ${T.titles[level - 1]}`;
  $("profBond").querySelector(".bar").style.setProperty("--pct", `${pct}%`);
  return level;
}

// Her stories: each opens at a bond level; the rest show what unlocks them.
function showStories(c, list, level) {
  const box = $("profStories");
  const blocks = list.map((s) => {
    if (level >= s.level) {
      const d = document.createElement("details");
      const sum = document.createElement("summary");
      sum.textContent = s.title[lang] || s.title.en;
      const body = document.createElement("p");
      body.textContent = s.text[lang] || s.text.en;
      d.append(sum, body);
      return d;
    }
    const locked = document.createElement("p");
    locked.className = "locked";
    locked.textContent = T.meStoryLocked(s.level);
    return locked;
  });
  box.replaceChildren(...blocks);
}

// Her three latest whispers; the text opens that whisper (whispers/?n=<id>).
async function showWhispers(c) {
  const list = $("profWhispers");
  const base = (window.POCO_CONFIG?.API_URL || "").replace(/\/+$/, "");
  const note = (text) => { const li = document.createElement("li"); li.className = "p-note"; li.textContent = text; list.replaceChildren(li); };
  if (!base) return note(T.whisperNone);
  try {
    const { whispers } = await getJson(`${base}/whispers`);
    const mine = whispers.filter((w) => w.ghost === c.id).slice(0, 3);
    if (!mine.length) return note(T.whisperNone);
    list.replaceChildren(...mine.map((w) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `whispers/?n=${w.n}`;
      a.className = "p-whisper";
      const text = document.createElement("span");
      text.textContent = w.text[lang] || w.text.en;
      const time = document.createElement("time");
      time.textContent = chatTime(w.t);
      time.dateTime = new Date(w.t).toISOString();
      a.append(text, time);
      li.append(a);
      return li;
    }));
  } catch {
    note(T.whisperError);
  }
}

export async function startProfile(charId) {
  let c;
  let stories = {};
  try {
    const [chars, st] = await Promise.all([getJson("characters.json"), getJson("stories.json").catch(() => ({}))]);
    c = chars.characters.find((x) => x.id === charId);
    stories = st;
  } catch { return; }
  if (!c) return;
  document.documentElement.style.setProperty("--accent", c.accent);
  const seo = c.seo || {};
  if (lang === "id" && seo.id) {
    const about = (seo.id.description || "").replaceAll("{name}", c.name);
    document.querySelector(".p-tagline").textContent = seo.id.tagline || c.statusId || c.status;
    document.querySelector(".p-about").textContent = about;
    document.title = `${c.name}, ${seo.id.tagline || ""} | ${document.title.split(" | ").pop()}`;
  }
  $("profChat").textContent = T.chatWith(c.name);
  $("profChat").setAttribute("href", loadMode(c.id) === "history" ? `${c.slug}/history/` : `${c.slug}/`);
  const level = showBond(c);
  showStories(c, stories[c.id] || [], level);
  showWhispers(c);
}
