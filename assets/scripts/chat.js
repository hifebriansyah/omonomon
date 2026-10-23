// The chat itself: who is on stage, sending a message, showing the reply,
// saving the conversation and clearing it. Ties the other modules together.

import { state, byId, inLang } from "./state.js";
import { input } from "./dom.js";
import * as stage from "./stage.js";
import { loadLog, saveLog, removeLog, rebuildHistory, saveCharacter } from "./storage.js";
import { getReply } from "./replies.js";

function greeting(c) {
  return c.library ? state.manifest.languages[state.lastLang].greeting : inLang(c.greeting);
}

// Record a message for character `id` and show it if that character is on stage.
function say(id, who, text, flags = {}) {
  (state.logs[id] ||= []).push({ who, text, ...flags });
  saveLog(id);
  if (state.current.id !== id) return;
  if (who === "bot") {
    stage.showBubble(text);
    stage.setScreenReaderText(text);
    stage.animateHero("talk");
  } else {
    stage.showYou(text);
  }
  stage.addHistoryRow(state.current, who, text);
}

// Put a character on stage, restoring her saved chat (or starting with her greeting).
export function selectCharacter(id) {
  const c = byId(id);
  state.current = c;
  stage.applyCharacter(c);
  saveCharacter(id);

  if (!state.logs[id]?.length) {
    const saved = loadLog(id);
    if (saved?.length) {
      state.logs[id] = saved;
      rebuildHistory(id);
    }
  }
  const fresh = !state.logs[id]?.length;
  if (fresh) state.logs[id] = [{ who: "bot", text: greeting(c), g: true }];
  const log = state.logs[id];
  const lastBot = [...log].reverse().find((m) => m.who === "bot") || { text: greeting(c) };
  const lastUser = [...log].reverse().find((m) => m.who === "user");

  if (lastUser) stage.showYou(lastUser.text);
  else stage.hideYou();
  if (state.pending[id] > 0) stage.showThinking();
  else stage.showBubble(lastBot.text, { instant: !fresh });
  stage.setScreenReaderText(lastBot.text);
  stage.animateHero("swap");
  stage.refreshHistory(c, log);
  input.focus();
}

async function botReply(c, text) {
  const ep = state.epoch[c.id] || 0;
  state.pending[c.id] = (state.pending[c.id] || 0) + 1;
  if (state.current.id === c.id) stage.showThinking();
  const delay = new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
  let reply;
  let failed = false;
  try {
    reply = await getReply(c, text);
  } catch (err) {
    reply = `Something went wrong (${err.message}).`;
    failed = true;
  }
  await delay;
  if ((state.epoch[c.id] || 0) !== ep) return; // the chat was cleared while we waited
  state.pending[c.id]--;
  if (!failed) (state.histories[c.id] ||= []).push({ role: "user", text }, { role: "model", text: reply });
  say(c.id, "bot", reply, failed ? { e: true } : {});
}

// Called by the input box. Returns false if the app isn't ready, so the text stays put.
export function sendMessage(text) {
  if (!state.manifest || !state.current) return false;
  say(state.current.id, "user", text);
  botReply(state.current, text);
}

export function toggleHistory() {
  stage.toggleHistory(state.current, state.logs[state.current.id] || []);
}

export function clearChat() {
  const c = state.current;
  if (!confirm(`Clear your chat with ${c.name}?`)) return;
  delete state.logs[c.id];
  delete state.histories[c.id];
  state.pending[c.id] = 0;
  state.epoch[c.id] = (state.epoch[c.id] || 0) + 1;
  removeLog(c.id);
  stage.closeHistory();
  selectCharacter(c.id);
}
