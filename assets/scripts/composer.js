// The message box: length limit (saves tokens), the counter, and sending.
// The Worker enforces its own cap too, because a page-only limit can be bypassed.

import { form, input, countEl } from "./dom.js";

export function initComposer(onSend) {
  const MAX_INPUT = window.POCO_CONFIG.INPUT_MAX_CHARS || 200;
  input.maxLength = MAX_INPUT;

  function updateCount() {
    const n = input.value.length;
    const show = n >= MAX_INPUT * 0.75;
    countEl.hidden = !show;
    countEl.textContent = `${n}/${MAX_INPUT}`;
    countEl.classList.toggle("full", n >= MAX_INPUT);
    input.parentElement.classList.toggle("counting", show);
  }
  input.addEventListener("input", updateCount);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, MAX_INPUT);
    if (!text) return;
    if (onSend(text) === false) return;
    input.value = "";
    updateCount();
  });
}
