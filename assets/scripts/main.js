// Ghost Chat: pick a character and talk to them.
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

import { state, byId } from "./state.js";
import { DATA_BASE } from "./rules.js";
import { bubbleText, historyBtn, clearBtn } from "./dom.js";
import { buildPicker } from "./stage.js";
import { selectCharacter, sendMessage, toggleHistory, clearChat } from "./chat.js";
import { initComposer } from "./composer.js";
import { loadCharacter } from "./storage.js";

async function getJson(url, what) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what} HTTP ${res.status}`);
  return res.json();
}

async function init() {
  initComposer(sendMessage);
  historyBtn.addEventListener("click", toggleHistory);
  clearBtn.addEventListener("click", clearChat);

  try {
    const [manifest, chars] = await Promise.all([
      getJson(`${DATA_BASE}manifest.json`, "manifest"),
      getJson("characters.json", "characters"),
    ]);
    state.manifest = manifest;
    state.characters = chars.characters;

    // Greet in the browser's language when we support it.
    const browser = (navigator.language || "").slice(0, 2);
    state.lastLang = manifest.langs.includes(browser) ? browser : manifest.defaultLang;

    buildPicker(state.characters, selectCharacter);
    const saved = loadCharacter();
    selectCharacter(byId(saved) ? saved : chars.default);
  } catch (err) {
    bubbleText.textContent =
      `Could not start (${err.message}). Run "python3 build.py", then serve this folder over http, e.g. "python3 -m http.server".`;
  }
}

init();
