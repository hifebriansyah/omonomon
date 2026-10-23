// Everything you see: the big character, the comic bubbles, the picker and the
// history panel. These functions only change the page; they know nothing about
// chats or Gemini.

import {
  stageEl, pickerEl, nameEl, statusEl, heroEl, bubbleEl, bubbleText,
  youBubble, youText, srEl, historyBtn, historyEl, messagesEl, input,
} from "./dom.js";
import { hrefFor } from "./router.js";

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
  heroEl.classList.add(cls);
}

export function setScreenReaderText(text) {
  srEl.textContent = text;
}

// ---- Picker and character look ----

// Each character is a real link (so it can be opened, shared and crawled). A normal click is
// handled by `onPick` without reloading; the same markup is pre-built by tools/make_site.py.
export function buildPicker(characters, onPick, isPlainClick) {
  pickerEl.replaceChildren(...characters.map((c) => {
    const a = document.createElement("a");
    a.href = hrefFor(c);
    a.dataset.id = c.id;
    const img = document.createElement("img");
    img.src = c.image;
    img.alt = "";
    a.append(img, document.createTextNode(c.name));
    a.addEventListener("click", (e) => {
      if (!isPlainClick(e)) return;
      e.preventDefault();
      onPick(c.id);
    });
    return a;
  }));
}

// While Gemini keeps failing the status line says so (text = null puts the character's own status back).
let troubleText = null;
export function setTrouble(text, c) {
  troubleText = text;
  if (c) statusEl.textContent = text || c.status;
}

// Put a character on stage: colour, picture, name, status, placeholder, picker highlight.
export function applyCharacter(c) {
  layoutBubble();
  document.documentElement.style.setProperty("--accent", c.accent);
  heroEl.src = c.stage;
  heroEl.alt = c.name;
  nameEl.textContent = c.name;
  statusEl.textContent = troubleText || c.status;
  input.placeholder = `Say something to ${c.name}...`;
  pickerEl.querySelectorAll("a").forEach((a) => {
    if (a.dataset.id === c.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

// ---- History panel: the full log for the open character ----

// WhatsApp-style times and day labels. They follow the visitor's browser language and clock format
// (an Indonesian browser gets "Hari ini", "Kemarin" and 24-hour times).
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dayKey = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function dayLabel(t) {
  const day = new Date(t);
  const now = new Date();
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = Math.round((midnight(now) - midnight(day)) / 86400000);
  if (daysAgo === 0 || daysAgo === 1) {
    const word = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-daysAgo, "day"); // today / yesterday
    return word.charAt(0).toLocaleUpperCase() + word.slice(1);
  }
  if (daysAgo > 1 && daysAgo < 7) return day.toLocaleDateString(undefined, { weekday: "long" });
  const sameYear = day.getFullYear() === now.getFullYear();
  return day.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

let lastDay = null;    // the day of the last row drawn, to know when to add a new date label
let chatStart = null;  // when the first timed message was sent; the greeting has no time, so it uses this day

function appendMessage(c, m) {
  // Messages saved before times existed have none, so they get no label. The greeting joins the first day.
  const t = m.t ?? (m.g ? chatStart : null);
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
    img.src = c.image;
    img.alt = "";
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
  chatStart = log.find((m) => m.t != null)?.t ?? null;
  for (const m of log) appendMessage(c, m);
  historyEl.scrollTop = historyEl.scrollHeight;
}

function setHistoryOpen(open) {
  historyEl.hidden = !open;
  historyBtn.setAttribute("aria-expanded", String(open));
  // The button shows icons (CSS swaps history <-> close); its name is only for screen readers and the tooltip.
  const label = open ? "Close chat history" : "Show chat history";
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
