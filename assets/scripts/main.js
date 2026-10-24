// Omon Omon: pick a character and talk to them.
// Replies come from Gemini (via the Worker). Pocomon also has a sharded JSON rule
// library as backup; the other characters fall back to a few in-character lines.
// Crisis phrases are always answered by the local safety rule and never sent to Gemini.
//
// Modules (all in this folder):
//   state.js    shared data          dom.js       page elements
//   util.js     small helpers        rules.js     local rule library lookup
//   replies.js  safety, Gemini, backup replies
//   storage.js  saved chats          stage.js     big character, bubbles, history panel
//   chat.js     sending, showing, clearing        composer.js  the message box
//   viewport.js the chat follows the visible height when the keyboard opens
//   router.js   addresses (/<slug>/, /<slug>/history/) and the page <head>

import { state } from "./state.js";
import { bubbleText, historyBtn, headAvatar } from "./dom.js";
import { showRoute, sendMessage, toggleHistory } from "./chat.js";
import { startRouter } from "./router.js";
import { initComposer } from "./composer.js";
import { lang } from "./games/text.js";
import "./viewport.js";
import { nameEl } from "./dom.js";
import { smartBack } from "./back.js";
import "./report.js";
import "./offline.js";


async function getJson(url, what) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what} HTTP ${res.status}`);
  return res.json();
}

// Keyboard focus rings only while someone is really tabbing between controls (see style.css).
// A click removes them, and so does leaving the keyboard alone.
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") document.documentElement.classList.add("using-tab");
});
document.addEventListener("pointerdown", () => document.documentElement.classList.remove("using-tab"));

async function init() {
  initComposer(sendMessage);
  historyBtn.addEventListener("click", toggleHistory);

  try {
    const [manifest, chars, site] = await Promise.all([
      getJson("builds/data/manifest.json", "manifest"),  // a plain string, so the build can add ?v= to it
      getJson("characters.json", "characters"),
      getJson("site.json", "site"),
    ]);
    state.manifest = manifest;
    state.characters = chars.characters;
    state.trouble = chars.trouble;
    state.site = site;

    // Greet in the visitor's language: the one chosen on the Me page, otherwise the browser's.
    state.lastLang = manifest.langs.includes(lang) ? lang : manifest.defaultLang;

    // Every chat page is a character's own address; anything else falls back to the default character.
    startRouter(showRoute, (r) => (r.id ? r : { ...r, id: chars.default, history: false }));
  } catch (err) {
    bubbleText.textContent =
      `Could not start (${err.message}). Run "python3 tools/build_all.py" once, then open the site through a web server (not as a file).`;
  }
}

init();

// The ghost's picture and name in the chat header open her profile page.
for (const el of [headAvatar, nameEl]) {
  if (!el) continue;
  el.style.cursor = "pointer";
  el.setAttribute("role", "link");
  el.tabIndex = 0;
  const go = () => { const slug = headAvatar.dataset.slug; if (slug) location.href = new URL(`${slug}/profile/`, document.baseURI).href; };
  el.addEventListener("click", go);
  el.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}

smartBack(document.getElementById("backBtn")); // back from a ghost's chat returns to the page the visitor came from (her profile, the chat list)
