// The /room/ page: your Ghost Room (the furniture you bought), or a friend's room when the link carries one in its #hash
// (#r=furn-lamp,furn-rug). The scene itself is games/../three/room.js (3D, with a 2D fallback).

import { load } from "../games/progress.js";
import { ITEMS } from "../games/cosmetics.js";
import { T, lang } from "../games/text.js";

const $ = (id) => document.getElementById(id);
const FURNITURE = new Set(ITEMS.filter((i) => i.kind === "room").map((i) => i.id));

function sharedItems() {
  const m = /[#&]r=([\w,-]*)/.exec(location.hash);
  return m ? m[1].split(",").filter((id) => FURNITURE.has(id)) : null;
}

export async function startRoomPage() {
  const shared = sharedItems();
  const p = load();
  const items = shared || p.owned.filter((id) => FURNITURE.has(id));
  const chars = (await (await fetch("characters.json")).json()).characters;
  const { mountRoom } = await import("../three/room.js");
  const room = await mountRoom($("roomRoot"), { items, accent: "#a47fd0", stage: p.equipped.stage, chars, lang, T });
  $("roomNote").textContent = shared ? T.roomShared : items.length ? "" : T.roomEmpty;
  $("roomShare").hidden = Boolean(shared) || !items.length;
  $("roomShare").addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#r=${items.join(",")}`;
    try {
      if (navigator.share) await navigator.share({ title: T.roomTitle, url });
      else { await navigator.clipboard.writeText(url); $("roomNote").textContent = T.roomCopied; }
    } catch {}
  });
  addEventListener("pagehide", () => room?.destroy?.());
}
