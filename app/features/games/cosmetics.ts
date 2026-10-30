// What Candles buy: looks for the chat stage and the speech bubble. Cosmetic only, never an advantage.
// The CSS for each item is in app/styles/app.css (html[data-stage="..."], html[data-bubble="..."]).
import { balance, levelOf, load, saveProgress } from "./progress";
import { todOf } from "./tod";

export type ItemKind = "stage" | "bubble" | "frame" | "room";
export interface Item {
  id: string;
  kind: ItemKind;
  price: number;
  reward?: boolean;
}

// price in Candles; names are in the i18n files (shopItems)
export const ITEMS: Item[] = [
  { id: "stage-stripes", kind: "stage", price: 60 },
  { id: "stage-grid", kind: "stage", price: 80 },
  { id: "stage-stars", kind: "stage", price: 120 },
  { id: "stage-dusk", kind: "stage", price: 180 },
  { id: "bubble-mint", kind: "bubble", price: 50 },
  { id: "bubble-rose", kind: "bubble", price: 50 },
  { id: "bubble-sky", kind: "bubble", price: 50 },
  { id: "bubble-night", kind: "bubble", price: 150 },
  { id: "frame-gold", kind: "frame", price: 100 },
  { id: "frame-ember", kind: "frame", price: 120 },
  { id: "frame-moon", kind: "frame", price: 150 },
  { id: "frame-rainbow", kind: "frame", price: 250 },
  // furniture for the Ghost Room (/room/): bought once, always placed there
  { id: "furn-lamp", kind: "room", price: 60 },
  { id: "furn-rug", kind: "room", price: 80 },
  { id: "furn-poster", kind: "room", price: 70 },
  { id: "furn-plant", kind: "room", price: 70 },
  { id: "furn-window", kind: "room", price: 120 },
  { id: "furn-bed", kind: "room", price: 150 },
  // given for free at bond level 8 with that ghost (see progress.ts, grantBondRewards); shown in the shop only once owned
  ...["1", "2", "3", "4"].map((id): Item => ({ id: `frame-ribbon-${id}`, kind: "frame", price: 0, reward: true })),
];

// Bond level 5 with a ghost gives her own stage look, free, in her chat (see app.css, html[data-ghost-stage]).
export const GHOST_STAGE_LEVEL = 5;

export const find = (id: string) => ITEMS.find((i) => i.id === id);

// Buy an item with Candles. Returns "ok", "owned" or "poor".
export function buy(id: string): "ok" | "owned" | "poor" {
  const item = find(id);
  const p = load();
  if (!item) return "poor";
  if (p.owned.includes(id)) return "owned";
  if (balance(p) < item.price) return "poor";
  p.spent = (p.spent || 0) + item.price;
  p.owned.push(id);
  if (item.kind !== "room") p.equipped[item.kind] = id; // a new look is worn straight away; furniture is simply placed in the room
  saveProgress(p);
  return "ok";
}

// Wear an owned item, or take the look off with id = "none" ("" would not survive a sync: an empty value means "not set").
export function equip(kind: Exclude<ItemKind, "room">, id: string) {
  const p = load();
  if (id !== "none" && !p.owned.includes(id)) return;
  p.equipped[kind] = id;
  saveProgress(p);
}

// Put the worn looks on the page. `charId` is the ghost on stage (chat page), or none. Browser only: call it in an effect.
export function applyCosmetics(charId?: string) {
  const p = load();
  const root = document.documentElement;
  const wear = (attr: string, value: string | undefined) => (value && value !== "none" ? root.setAttribute(attr, value) : root.removeAttribute(attr));
  wear("data-stage", p.equipped.stage?.replace("stage-", ""));
  wear("data-bubble", p.equipped.bubble?.replace("bubble-", ""));
  root.setAttribute("data-tod", todOf()); // night darkens the chat stage a little (app.css)
  wear("data-frame", p.equipped.frame?.replace("frame-", ""));
  wear("data-ghost-stage", charId && levelOf(p.bond[charId] || 0) >= GHOST_STAGE_LEVEL ? charId : "");
}
