// The chat itself: who is on stage, sending a message, showing the reply,
// saving the conversation and clearing it. Ties the other modules together.

import { state, byId, inLang } from "./state.js";
import { input } from "./dom.js";
import * as stage from "./stage.js";
import { loadLog, saveLog, rebuildHistory, saveMode, firstSeen } from "./storage.js";
import { getReply } from "./replies.js";
import { navigate } from "./router.js";
import { recordChat } from "./games/progress.js";
import { questLabel } from "./games/quests.js";
import { T, lang } from "./games/text.js";
import { toast } from "./toast.js";

const TROUBLE_AFTER = 3;

function greeting(c) {
  return c.library ? state.manifest.languages[state.lastLang].greeting : inLang(c.greeting);
}

// The greeting is not saved, but it has a time: when you first met her (or the oldest saved message, if earlier).
const greetingMessage = (c, saved = []) => ({
  who: "bot", text: greeting(c), g: true, t: Math.min(firstSeen(c.id), saved[0]?.t ?? Infinity),
});

// Record a message for character `id` and show it if that character is on stage.
function say(id, who, text, flags = {}) {
  const msg = { who, text, t: Date.now(), ...flags };
  (state.logs[id] ||= []).push(msg);
  saveLog(id);
  if (state.current.id !== id) return;
  if (who === "bot") {
    stage.showBubble(text);
    stage.setScreenReaderText(text);
    stage.animateHero("talk");
  } else {
    stage.showYou(text);
  }
  stage.addHistoryRow(state.current, msg, state.logs[id]);
}

// Put a character on stage, restoring her saved chat (or starting with her greeting).
export function selectCharacter(id) {
  const c = byId(id);
  state.current = c;
  stage.applyCharacter(c);

  if (!state.logs[id]?.length) {
    const saved = loadLog(id);
    if (saved?.length) {
      // the greeting is not saved: show today's greeting (and today's name) above the old messages
      state.logs[id] = [greetingMessage(c, saved), ...saved];
      rebuildHistory(id);
    }
  }
  const fresh = !state.logs[id]?.length;
  if (fresh) state.logs[id] = [greetingMessage(c)];
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
  // A desktop (mouse, no touch screen) has a real keyboard: start typing at once. A phone or tablet would open the
  // on-screen keyboard just by landing on the chat, so it is left alone (composer.js focuses on a real key press instead).
  if (matchMedia("(hover: hover) and (pointer: fine)").matches && !navigator.maxTouchPoints) input.focus();
}

async function botReply(c, text) {
  state.pending[c.id] = (state.pending[c.id] || 0) + 1;
  if (state.current.id === c.id) stage.showThinking();
  const delay = new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
  let reply;
  let failed = false;
  try {
    ({ text: reply, error: failed = false } = await getReply(c, text));
  } catch (err) {
    reply = `Something went wrong (${err.message}).`;
    failed = true;
  }
  await delay;
  state.pending[c.id]--;
  // After a few Gemini failures in a row the status line says so, until the next success.
  stage.setTrouble(state.failures >= TROUBLE_AFTER ? inLang(state.trouble) : null, state.current);
  if (!failed) (state.histories[c.id] ||= []).push({ role: "user", text }, { role: "model", text: reply });
  say(c.id, "bot", reply, failed ? { e: true } : {});
}

// Called by the input box. Returns false if the app isn't ready, so the text stays put.
export function sendMessage(text) {
  if (!state.manifest || !state.current) return false;
  say(state.current.id, "user", text);
  rewardMessage(state.current);
  botReply(state.current, text);
}

// A sent message earns a little bond XP and counts for the daily quests; tell the player about the good news.
function rewardMessage(c) {
  const r = recordChat(c.id, state.characters);
  const lines = [];
  if (r.levelAfter > r.levelBefore) lines.push(T.bondLevelUp(c.name, r.levelAfter, T.titles[r.levelAfter - 1]));
  for (const q of r.completed) lines.push(T.questDone(questLabel(q, lang, state.characters), q.reward));
  if (r.allDone) lines.push(T.allQuestsDone(10));
  if (lines.length) toast(lines);
}

// Show what an address asks for: a character, and her history panel open or closed.
export function showRoute({ id, history }) {
  if (state.current?.id !== id) selectCharacter(id);
  stage.setHistory(history, state.current, state.logs[id] || []);
  saveMode(id, history); // the chat list reopens this chat in the same view
}

export function toggleHistory() {
  navigate({ id: state.current.id, history: !stage.isHistoryOpen() });
}
