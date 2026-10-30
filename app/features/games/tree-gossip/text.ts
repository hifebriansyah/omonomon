// Gosip Pohon's own words (the TEXT table of the old tree-gossip.js).
import type { Lang } from "~/lib/content";
import { LIVES } from "./logic";

const hearts = (n: number) => "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, LIVES - n));

const en = {
  score: "Secrets",
  lives: (n: number) => "Lives: " + hearts(n),
  spot: (n: number) => "Branch " + n,
  secret: "secret",
  crow: "crow",
  bat: "bat",
  empty: "empty",
  begin: "Tap the secrets as they peek out!",
  streak: (n: number) => "Streak x" + n,
  oops: "Oops, a decoy!",
  again: "Play again",
};

export const TEXT: Record<Lang, typeof en> = {
  en,
  id: {
    score: "Rahasia",
    lives: (n) => "Nyawa: " + hearts(n),
    spot: (n) => "Dahan " + n,
    secret: "rahasia",
    crow: "gagak",
    bat: "kelelawar",
    empty: "kosong",
    begin: "Tap rahasia yang mengintip!",
    streak: (n) => "Beruntun x" + n,
    oops: "Ups, itu umpan!",
    again: "Main lagi",
  },
};

export const ICON = { secret: "✉", crow: "🐦‍⬛", bat: "🦇" } as const;
