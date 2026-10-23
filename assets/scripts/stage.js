// Everything you see: the big character, the comic bubbles, the picker and the
// history panel. These functions only change the page; they know nothing about
// chats or Gemini.

import {
  stageEl, pickerEl, nameEl, statusEl, heroEl, bubbleEl, bubbleText,
  youBubble, youText, srEl, historyBtn, historyEl, messagesEl, input,
} from "./dom.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FONT_STEPS = [1.15, 1.05, 0.96, 0.88, 0.8, 0.74]; // rem

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
  for (const size of FONT_STEPS) {
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
  heroEl.classList.add(cls);
}

export function setScreenReaderText(text) {
  srEl.textContent = text;
}

// ---- Picker and character look ----

export function buildPicker(characters, onPick) {
  for (const c of characters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = c.id;
    btn.setAttribute("aria-pressed", "false");
    const img = document.createElement("img");
    img.src = c.image;
    img.alt = "";
    btn.append(img, document.createTextNode(c.name));
    btn.addEventListener("click", () => onPick(c.id));
    pickerEl.append(btn);
  }
}

// Put a character on stage: colour, picture, name, status, placeholder, picker highlight.
export function applyCharacter(c) {
  layoutBubble();
  document.documentElement.style.setProperty("--accent", c.accent);
  heroEl.src = c.stage;
  heroEl.alt = c.name;
  nameEl.textContent = c.name;
  statusEl.textContent = c.status;
  input.placeholder = `Say something to ${c.name}...`;
  pickerEl.querySelectorAll("button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.id === c.id))
  );
}

// ---- History panel: the full log for the open character ----

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

function renderHistory(c, log) {
  messagesEl.replaceChildren();
  for (const m of log) appendRow(c, m.who, m.text);
  historyEl.scrollTop = historyEl.scrollHeight;
}

function setHistoryOpen(open) {
  historyEl.hidden = !open;
  historyBtn.setAttribute("aria-expanded", String(open));
  historyBtn.textContent = open ? "Close" : "History";
}

export function toggleHistory(c, log) {
  const open = historyEl.hidden;
  setHistoryOpen(open);
  if (open) renderHistory(c, log);
}

export function closeHistory() {
  setHistoryOpen(false);
}

// Re-draw the panel if it is open (after switching character).
export function refreshHistory(c, log) {
  if (!historyEl.hidden) renderHistory(c, log);
}

// Add one new row if the panel is open.
export function addHistoryRow(c, who, text) {
  if (historyEl.hidden) return;
  appendRow(c, who, text);
  historyEl.scrollTop = historyEl.scrollHeight;
}
