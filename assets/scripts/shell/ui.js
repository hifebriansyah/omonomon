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
export const backIcon = () => icon("m12 19-7-7 7-7", "M19 12H5");   // the same arrow as the back buttons in the generated pages
export const shareIcon = () => icon("M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13");

// The share button under a whisper (url: that whisper's page): the phone's share sheet where there is one, otherwise the text is copied
// (the word "Copied" shows beside the icon for a moment).
// text is optional: with none, only the link is shared (the link preview already carries the words)
export function shareButton(text, url = `${location.origin}/`) {
  const button = el("button", "w-share");
  button.type = "button";
  button.title = T.shareWord;
  button.setAttribute("aria-label", T.shareWord);
  const note = el("span", "w-count");
  button.append(shareIcon(), note);
  button.addEventListener("click", async () => {
    try {
      if (navigator.share) { await navigator.share(text ? { text, url } : { url }); return; }
      await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
      note.textContent = T.copiedWord;
      setTimeout(() => { note.textContent = ""; }, 1800);
    } catch {} // the visitor closed the share sheet, or copying is not allowed: nothing to do
  });
  return button;
}
export const sendIcon = () => icon("M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z", "M6 12h16");

// The card under a whisper for what the ghost found: its picture, title and where it is from. It opens the original in a new tab.
// Only https addresses are used, whatever the server sent.
const https = (u) => typeof u === "string" && /^https:\/\//.test(u);
// An Instagram reel (instagram.com/reel/<id>, /reels/<id> or its /embed/ page): its card opens the reel itself (the plain address, without tracking
// parameters; on a phone with the Instagram app it opens the app) and shows a play button on its cover.
const reelId = (url) => /^https:\/\/www\.instagram\.com\/reels?\/([\w-]{5,20})\/?(?:embed\/?)?(?:[?#]|$)/.exec(url)?.[1] || null;

// A plain thought (a whisper with no link or picture) is shown as a square sticky note: pastel paper, white text. The paper colour is the
// ghost's own (a softened version of her accent, deep enough for white letters), so the colour tells who wrote it; the text stays real text
// (copyable, readable by screen readers).
const NOTE_COLORS = { pocomon: "#a07fd6", ngesomon: "#e2707f", sundemon: "#d99a3a", kuntimon: "#4db58a" };
export function noteFrame(w, text, href, ghost) {
  const note = el(href ? "a" : "div", "w-note");
  if (href) note.href = href;
  note.style.setProperty("--note", NOTE_COLORS[ghost?.slug] || ghost?.accent || "#8d9ae8");
  note.style.setProperty("--tilt", `${(Number(w.n) || 0) % 2 ? -0.7 : 0.6}deg`);
  note.dataset.size = text.length <= 50 ? "s" : text.length <= 100 ? "m" : "l";   // short thoughts get bigger letters
  note.append(el("span", "w-note-text", text));
  return note;
}

export function linkCard(link) {
  if (!link || !https(link.url)) return null;
  const reel = reelId(link.url);
  const a = el("a", "w-card");
  a.href = reel ? `https://www.instagram.com/reel/${reel}/` : link.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer nofollow";
  let media = null;   // the picture (and, for a reel, the play button on it)
  if (https(link.thumb)) {
    const img = el("img");
    img.src = link.thumb;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";  // some sites refuse pictures that come with another site's address
    img.addEventListener("error", () => img.remove()); // a picture that is gone leaves just the title
    if (reel) { media = el("span", "w-card-media"); media.append(img); } else a.append(img);
  } else if (reel) {
    media = el("span", "w-card-media w-card-nocover");   // a reel without a cover still gets its play button, on a plain panel
  }
  if (media) {
    const play = el("span", "w-card-play");
    play.setAttribute("aria-hidden", "true");
    play.append(el("span", "", "\u25B6"));
    media.append(play);
    a.append(media);
  }
  const text = el("span", "w-card-text");
  text.append(el("strong", "", String(link.title || link.url)), el("small", "", String(link.source || new URL(link.url).hostname)));
  a.append(text);
  return a;
}
