// Keeps the chat the size of what is really visible, like WhatsApp: when the keyboard opens, the header stays at the top,
// the chat shrinks to fit above the keyboard and the newest message stays in view.
// Chrome on Android does most of this by itself (interactive-widget=resizes-content in chat.html); iOS Safari does not
// resize the page, it scrolls it up under the header instead, so this sets --app-h (the visible height) and scrolls back.

import { input, historyEl } from "./dom.js";
import { layoutBubble } from "./stage.js";

const vv = window.visualViewport;
let height = 0;
let queued = false;

function fit() {
  queued = false;
  if (vv && vv.scale > 1.01) return;  // pinch-zoomed: leave the layout and the panning alone
  const h = Math.round(vv ? vv.height : window.innerHeight);
  if (window.scrollY || (vv && vv.offsetTop)) window.scrollTo(0, 0);  // the page itself never scrolls: only the chat does
  if (h === height) return;
  const shrank = h < height;
  height = h;
  document.documentElement.style.setProperty("--app-h", `${h}px`);
  layoutBubble();  // the bubble's share of the stage follows the new height
  if (shrank && document.activeElement === input) historyEl.scrollTop = historyEl.scrollHeight;  // newest message above the keyboard
}

function queue() {
  if (!queued) { queued = true; requestAnimationFrame(fit); }
}

if (vv) {
  vv.addEventListener("resize", queue);
  vv.addEventListener("scroll", queue);
} else {
  window.addEventListener("resize", queue);
}
input.addEventListener("focus", () => setTimeout(queue, 300));  // some keyboards report their size a moment late
fit();
