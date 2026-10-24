// The chat list (/): like WhatsApp, each ghost shows the latest message of your saved chat and its time, the
// newest chat first. A ghost you have not talked to yet shows her greeting and stays below the chats, in the
// usual order. The ... button on each row has one option for now: clear that chat.

import { loadLog, removeLog, loadMode, saveMode, firstSeen } from "../storage.js";
import { chatTime } from "../time.js";
import { T, lang } from "../games/text.js";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

// Lucide "trash-2" (ISC License)
function trashIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of ["M10 11v6", "M14 11v6", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M3 6h18", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export async function startHome() {
  const list = document.querySelector(".contacts");
  const greetings = {}; // id -> the greeting shown while there is no chat yet
  let characters = [];
  try {
    const [chars, manifest] = await Promise.all([getJson("characters.json"), getJson("builds/data/manifest.json")]);
    characters = chars.characters;
    for (const c of characters) {
      greetings[c.id] = c.library ? manifest.languages[lang]?.greeting : (c.greeting?.[lang] || c.greeting?.en);
    }
  } catch {} // previews are a nicety: without the data rows just show no preview
  const names = Object.fromEntries(characters.map((c) => [c.id, c.name]));

  function renderRow(li) {
    const id = li.dataset.id;
    const log = loadLog(id) || [];
    const last = log[log.length - 1];
    const preview = li.querySelector(".c-preview");
    const time = li.querySelector(".c-time");
    li.classList.toggle("has-chat", Boolean(last));
    // open the chat in the view it was left in (history or stage)
    const link = li.querySelector("a.contact");
    const slug = link.dataset.slug;
    link.setAttribute("href", loadMode(id) === "history" ? `${slug}/history/` : `${slug}/`);
    if (last) {
      preview.textContent = (last.who === "user" ? `${T.you} ` : "") + last.text;
    } else {
      preview.textContent = greetings[id] || "";
    }
    // a chat shows its latest message time, a ghost you have not talked to yet shows when you first met her
    const shown = last ? last.t : firstSeen(id);
    if (Number.isFinite(shown)) {
      time.textContent = chatTime(shown);
      time.dateTime = new Date(shown).toISOString();
    } else {
      time.textContent = "";
      time.removeAttribute("datetime");
    }
    return last;
  }

  // Chats by their latest message, newest first, then the ghosts without a chat in their original order.
  const lastTime = new Map(); // row -> time of its latest message
  [...list.children].forEach((li, i) => { li.dataset.order = i; });
  function refresh() {
    for (const li of list.children) lastTime.set(li, renderRow(li)?.t);
    const items = [...list.children].map((li) => ({ li, t: li.classList.contains("has-chat") ? (lastTime.get(li) ?? 0) : -1 }));
    items.sort((a, b) => b.t - a.t || Number(a.li.dataset.order) - Number(b.li.dataset.order));
    list.replaceChildren(...items.map((x) => x.li));
  }
  refresh();

  // ---- the ... menu ----
  let openMenu = null;
  function closeMenu() {
    if (!openMenu) return;
    openMenu.button.setAttribute("aria-expanded", "false");
    openMenu.el.remove();
    openMenu = null;
  }
  function showMenu(li, button) {
    closeMenu();
    const hasChat = li.classList.contains("has-chat");
    const el = document.createElement("div");
    el.className = "menu";
    el.setAttribute("role", "menu");
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.append(trashIcon(), document.createTextNode(T.clearChat));
    item.disabled = !hasChat;
    item.addEventListener("click", () => {
      closeMenu();
      if (!confirm(T.clearConfirm(names[li.dataset.id] || ""))) return;
      removeLog(li.dataset.id);
      saveMode(li.dataset.id, false); // an emptied chat opens on the stage again
      refresh();
    });
    el.append(item);
    li.append(el);
    button.setAttribute("aria-expanded", "true");
    openMenu = { el, button };
    if (!item.disabled) item.focus();
  }
  for (const li of list.children) {
    const button = li.querySelector(".more");
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenu?.button === button) closeMenu();
      else showMenu(li, button);
    });
  }
  document.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { const b = openMenu?.button; closeMenu(); b?.focus(); } });
  // coming back with Back/Forward restores the page from memory: show the latest chats again
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) refresh();
  });
}
