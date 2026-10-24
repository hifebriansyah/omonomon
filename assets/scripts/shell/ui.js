// Small helpers shared by the app pages: build elements safely and draw the icons made in script (Lucide, ISC License).

import { T } from "../games/text.js";

const SVG = "http://www.w3.org/2000/svg";

// An element with a class and text. Text is always set with textContent, so nothing from a visitor is ever treated as HTML.
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(...paths) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of paths) {
    const p = document.createElementNS(SVG, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

export const bubbleIcon = () => icon("M7.9 20A9 9 0 1 0 4 16.1L2 22Z");
export const heartIcon = () => icon("M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z");
export const shareIcon = () => icon("M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13");

// The share button under a whisper (url: that whisper's page): the phone's share sheet where there is one, otherwise the text is copied
// (the word "Copied" shows beside the icon for a moment).
export function shareButton(text, url = `${location.origin}/`) {
  const button = el("button", "w-share");
  button.type = "button";
  button.title = T.shareWord;
  button.setAttribute("aria-label", T.shareWord);
  const note = el("span", "w-count");
  button.append(shareIcon(), note);
  button.addEventListener("click", async () => {
    try {
      if (navigator.share) { await navigator.share({ text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      note.textContent = T.copiedWord;
      setTimeout(() => { note.textContent = ""; }, 1800);
    } catch {} // the visitor closed the share sheet, or copying is not allowed: nothing to do
  });
  return button;
}
export const sendIcon = () => icon("M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z", "M6 12h16");
