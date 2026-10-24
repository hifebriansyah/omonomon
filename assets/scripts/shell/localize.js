// Page text that lives in the data files (games.json, characters.json) instead of text.js. The pages are built in English,
// so for Indonesian it is filled in here: the games hub, a game's description, and the line under each ghost's name.

import { T, lang } from "../games/text.js";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

export async function localizeData(page) {
  if (lang !== "id") return;
  try {
    const [games, chars] = await Promise.all([getJson("games.json"), getJson("characters.json")]);
    const byId = Object.fromEntries(chars.characters.map((c) => [c.id, c]));
    const describe = (g) => g.id.description.replaceAll("{name}", byId[g.character]?.name || "");
    const site = document.title.split(" | ").pop(); // the site name at the end of every tab title
    const siteInfo = page === "home" ? await getJson("site.json").catch(() => ({})) : {};
    const titles = { whispers: `${T.tabWhispers} | ${site}`, me: `${T.tabMe} | ${site}`, loved: `${T.lovedTitle} | ${site}`, home: siteInfo.titleId };
    if (titles[page]) document.title = titles[page];
    const text = (selector, value, root = document) => { const el = root.querySelector(selector); if (el && value) el.textContent = value; };

    if (page === "home") {
      for (const li of document.querySelectorAll(".contacts li[data-id]")) text(".c-status", byId[li.dataset.id]?.statusId, li);
    } else if (page === "hub") {
      const hub = games.hub.id;
      text(".app-bar h1", hub.heading);
      text(".hub .intro", hub.intro);
      if (hub.title) document.title = hub.title;
      for (const card of document.querySelectorAll(".card[data-game]")) {
        const g = games.games.find((x) => x.slug === card.dataset.game);
        if (!g?.id) continue;
        text(".tagline", g.id.tagline, card);
        text(".desc", describe(g), card);
      }
    } else if (page === "game") {
      const g = games.games.find((x) => x.slug === document.body.dataset.game);
      if (!g?.id) return;
      text(".game .intro", describe(g));
      const name = byId[g.character]?.name;
      if (name) document.title = `${g.title} bareng ${name} | ${document.title.split(" | ").pop()}`;
    }
  } catch {} // without the Indonesian text the English one built into the page stays
}
