// Everything you see: the big character, the comic bubbles, the header and the
// history panel. These functions only change the page; they know nothing about
// chats or Gemini.

import {
  stageEl, headAvatar, nameEl, statusEl, heroEl, bubbleEl, bubbleText,
  youBubble, youText, srEl, historyBtn, historyEl, messagesEl, input,
} from "./dom.js";
import { timeFormat, dayKey, dayLabel } from "./time.js";
import { T, lang } from "./games/text.js";

// The line under her name, in the visitor's language (statusId is the Indonesian one).
const statusOf = (c) => (lang === "id" && c.statusId) || c.status;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FONT_STEPS = [1.15, 1.05, 0.96, 0.88, 0.8, 0.74]; // rem
// From this many characters on, a reply starts at a smaller size than the normal 1.15rem
// (it can still shrink further if it doesn't fit the bubble).
const LONG_REPLY_CHARS = 90;
const LONG_REPLY_STEP = 2; // index into FONT_STEPS: 0.96rem

let typeTimer = null;
let shown = ""; // full text of the bubble being typed

function stopTyping() {
  clearInterval(typeTimer);
  typeTimer = null;
}

// ---- The character's bubble ----

// The bubble gets a fixed share of the stage, so the character never shrinks.
// Long text shrinks to fit that space (down to a minimum, then it scrolls).
export function layoutBubble() {
  document.documentElement.style.setProperty("--bubble-max", `${Math.round(stageEl.clientHeight * 0.23)}px`);
  if (shown && !bubbleEl.classList.contains("thinking")) fitBubble(shown, true);
}

function fitBubble(text, keepText = false) {
  const current = bubbleText.textContent;
  bubbleText.textContent = text; // measure with the full text, even while it is being typed
  const first = text.length >= LONG_REPLY_CHARS ? LONG_REPLY_STEP : 0;
  for (const size of FONT_STEPS.slice(first)) {
    bubbleText.style.fontSize = `${size}rem`;
    if (bubbleText.scrollHeight <= bubbleText.clientHeight + 1) break;
  }
  if (keepText) bubbleText.textContent = current;
}

// Reveal text in the bubble letter by letter. Click the bubble to skip ahead.
export function showBubble(text, { instant = false } = {}) {
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

export function showThinking() {
  stopTyping();
  bubbleText.style.fontSize = "";
  bubbleEl.classList.add("thinking");
  bubbleText.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
}

bubbleEl.addEventListener("click", () => {
  if (typeTimer) { stopTyping(); bubbleText.textContent = shown; }
});
window.addEventListener("resize", layoutBubble);

// ---- The user's small bubble, the hero and screen-reader text ----

export function showYou(text) {
  youText.textContent = text;
  youBubble.title = text; // full text on hover; the bubble shows one line
  youBubble.hidden = false;
}

export function hideYou() {
  youBubble.hidden = true;
}

export function animateHero(cls) {
  heroEl.classList.remove("talk", "swap");
  void heroEl.offsetWidth; // restart the animation
  heroEl.classList.add("live", cls); // live: from now on the picture is shown (see .hero in style.css)
}

export function setScreenReaderText(text) {
  srEl.textContent = text;
}

// ---- Character look ----

// While Gemini keeps failing the status line says so (text = null puts the character's own status back).
let troubleText = null;
export function setTrouble(text, c) {
  troubleText = text;
  if (c) statusEl.textContent = text || statusOf(c);
}

// Put a character on stage: colour, picture, name, status, placeholder.
export function applyCharacter(c) {
  layoutBubble();
  document.documentElement.style.setProperty("--accent", c.accent);
  heroEl.src = c.stage;
  heroEl.alt = c.name;
  nameEl.textContent = c.name;
  statusEl.textContent = troubleText || statusOf(c);
  input.placeholder = T.sayTo(c.name);
  // the labels the page ships with are English
  const back = document.getElementById("backBtn");
  if (back) { back.setAttribute("aria-label", T.backChats); back.title = T.backChats; }
  const history = historyEl.hidden ? T.historyShow : T.historyClose;
  historyBtn.setAttribute("aria-label", history);
  historyBtn.title = history;
  const send = document.querySelector("#form button[type=submit]");
  if (send) { send.setAttribute("aria-label", T.sendWord); send.title = T.sendWord; }
  headAvatar.src = c.image;
  headAvatar.alt = "";
}

// ---- History panel: the full log for the open character ----

let lastDay = null;    // the day of the last row drawn, to know when to add a new date label
let chatStart = null;  // when the first timed message was sent; the greeting has no time, so it uses this day
let lastHead = null;   // the head next to the newest bot message: only that one is visible

function appendMessage(c, m) {
  // Messages saved before times existed have none, so they get no label. The greeting joins the first day.
  // The greeting has no time: it takes the day of the first message, or today while the chat is still empty.
  const t = m.t ?? (m.g ? (chatStart ?? Date.now()) : null);
  if (t != null && dayKey(t) !== lastDay) {
    const label = document.createElement("div");
    label.className = "day-label";
    label.textContent = dayLabel(t);
    messagesEl.append(label);
    lastDay = dayKey(t);
  }

  const row = document.createElement("div");
  row.className = `row ${m.who}`;
  if (m.who === "bot") {
    const img = document.createElement("img");
    img.className = "mini";
    img.src = c.head;
    img.alt = "";
    lastHead?.classList.add("old");  // hidden, not removed, so the bubbles stay lined up
    lastHead = img;
    row.append(img);
  }
  const bubble = document.createElement("div");
  bubble.className = `msg ${m.who}`;
  const text = document.createElement("span");
  text.textContent = m.text;
  bubble.append(text);
  if (m.t != null) {
    const time = document.createElement("time");
    time.dateTime = new Date(m.t).toISOString();
    time.textContent = timeFormat.format(m.t);
    bubble.append(time);
  }
  row.append(bubble);
  messagesEl.append(row);
}

function renderHistory(c, log) {
  messagesEl.replaceChildren();
  lastDay = null;
  lastHead = null;
  chatStart = log.find((m) => m.t != null)?.t ?? null;
  for (const m of log) appendMessage(c, m);
  historyEl.scrollTop = historyEl.scrollHeight;
}

function setHistoryOpen(open) {
  historyEl.hidden = !open;
  historyBtn.setAttribute("aria-expanded", String(open));
  // The button shows icons (CSS swaps history <-> close); its name is only for screen readers and the tooltip.
  const label = open ? T.historyClose : T.historyShow;
  historyBtn.setAttribute("aria-label", label);
  historyBtn.title = label;
}

export const isHistoryOpen = () => !historyEl.hidden;

// Open or close the panel to match the address.
export function setHistory(open, c, log) {
  if (open === isHistoryOpen()) return;
  setHistoryOpen(open);
  if (open) renderHistory(c, log);
}

// Re-draw the panel if it is open (after switching character).
export function refreshHistory(c, log) {
  if (!historyEl.hidden) renderHistory(c, log);
}

// Add one new message if the panel is open. The first timed message changes where the greeting's
// day label goes, so in that case the whole panel is drawn again.
export function addHistoryRow(c, m, log) {
  if (historyEl.hidden) return;
  if (chatStart == null) {
    renderHistory(c, log);
    return;
  }
  appendMessage(c, m);
  historyEl.scrollTop = historyEl.scrollHeight;
}
