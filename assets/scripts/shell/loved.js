// The loved whispers page (/loved/): the whispers this visitor tapped the heart on, newest love first.
// They come from this browser (loved-store.js), so they are still here after the feed has deleted them.

import { chatTime } from "../time.js";
import { T, lang } from "../games/text.js";
import { el, heartIcon, shareButton, linkCard } from "./ui.js";
import { lovedList, removeLove } from "./loved-store.js";
import { deviceId } from "./identity.js";

export async function startLoved() {
  const list = document.getElementById("lovedList");
  const note = document.getElementById("lovedNote");
  let byId = {};
  try {
    const res = await fetch("characters.json");
    byId = Object.fromEntries((await res.json()).characters.map((c) => [c.id, c]));
  } catch {} // without the names and pictures the text is still shown

  function render() {
    const items = lovedList();
    list.replaceChildren(...items.map((w) => {
      const c = byId[w.ghost] || { name: "", accent: "#a47fd0", image: "builds/img/favicon.ico" };
      const li = el("li", "whisper");
      li.style.setProperty("--c", c.accent);
      const img = el("img", "avatar");
      img.src = c.image;
      img.alt = "";
      const head = el("div", "w-head");
      const who = el("div", "w-who");
      const time = el("time", "", chatTime(w.t));
      time.dateTime = new Date(w.t).toISOString();
      who.append(el("strong", "", c.name), time);
      head.append(img, who);
      const love = el("button", "w-love");
      love.type = "button";
      love.title = T.unloveWord;
      love.setAttribute("aria-label", T.unloveWord);
      love.setAttribute("aria-pressed", "true");
      love.append(heartIcon());
      love.addEventListener("click", () => {
        removeLove(w.n);
        render();
        // also take the love off the public count (if the whisper still exists); it does not matter if this fails
        const base = (window.POCO_CONFIG?.API_URL || "").replace(/\/+$/, "");
        if (base) {
          fetch(`${base}/whispers/${w.n}/love`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device: deviceId() }) }).catch(() => {});
        }
      });
      const actions = el("div", "w-actions");
      actions.append(love, shareButton(`${c.name}: ${w.text[lang] || w.text.en}`, `${location.origin}/whispers/${c.slug ? `${c.slug}/` : ""}?n=${w.n}`));
      li.append(head, el("p", "w-text", w.text[lang] || w.text.en), ...[linkCard(w.link)].filter(Boolean), actions);
      return li;
    }));
    note.textContent = items.length ? "" : T.lovedNone;
    note.hidden = items.length > 0;
  }
  render();
}
