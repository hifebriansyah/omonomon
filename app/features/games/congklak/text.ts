import type { Lang } from "~/lib/content";
import type { Difficulty } from "./logic";

export const TEXT: Record<
  Lang,
  {
    pick: string;
    lv: Record<Difficulty, string>;
    yourTurn: string;
    theirTurn: (n: string) => string;
    again: string;
    cap: (n: number) => string;
    youHouse: string;
    hole: (n: number, c: number) => string;
    win: string;
    lose: string;
    draw: string;
    skip: string;
    store: string;
  }
> = {
  en: {
    pick: "Pick the opponent",
    lv: { easy: "gentle", medium: "steady", mediumhard: "sharp", hard: "relentless" },
    yourTurn: "Your turn: pick one of your holes.",
    theirTurn: (n) => `${n} is sowing...`,
    again: "Landed in your house: go again!",
    cap: (n) => `Captured ${n} seeds!`,
    youHouse: "You",
    hole: (n, c) => `Hole ${n}, ${c} seeds`,
    win: "You win!",
    lose: "They win.",
    draw: "A draw.",
    skip: "Quiet turn.",
    store: "house",
  },
  id: {
    pick: "Pilih lawan",
    lv: { easy: "santai", medium: "stabil", mediumhard: "tajam", hard: "tanpa ampun" },
    yourTurn: "Giliranmu: pilih salah satu lubangmu.",
    theirTurn: (n) => `${n} lagi menabur...`,
    again: "Mendarat di lumbungmu: jalan lagi!",
    cap: (n) => `Menang ${n} biji!`,
    youHouse: "Kamu",
    hole: (n, c) => `Lubang ${n}, ${c} biji`,
    win: "Kamu menang!",
    lose: "Dia menang.",
    draw: "Seri.",
    skip: "Giliran sepi.",
    store: "lumbung",
  },
};
