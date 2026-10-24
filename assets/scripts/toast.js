// A short message at the top of the page ("Bond level 3 with ...", "Quest done ..."). Several messages are shown one
// after the other. The element is <div id="toast"> in chat.html.

const el = document.getElementById("toast");
const queue = [];
let showing = false;

function next() {
  const text = queue.shift();
  if (!text) { showing = false; el.hidden = true; return; }
  showing = true;
  el.textContent = text;
  el.hidden = false;
  setTimeout(next, 3200);
}

export function toast(lines) {
  if (!el) return;
  queue.push(...[].concat(lines));
  if (!showing) next();
}
