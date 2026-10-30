// Bunga Kenangan's own words (the TEXT table of the old memory-garden.js).
import type { Lang } from "~/lib/content";

const en = {
  moves: "Moves",
  score: "Petals",
  hint: "Swap two neighbouring petals to line up three.",
  wiggle: "That one does not fit.",
  shuffle: "The petals drift into new places.",
  over: "The garden rests.",
  cell: (k: number, r: number, c: number) => `${["round pink", "pointed gold", "square blue", "diamond green", "star violet"][k]} petal, row ${r + 1}, column ${c + 1}`,
  chain: (n: number) => `Chain x${n}`,
};

export const TEXT: Record<Lang, typeof en> = {
  en,
  id: {
    moves: "Langkah",
    score: "Kelopak",
    hint: "Tukar dua kelopak yang bersebelahan sampai tiga sejajar.",
    wiggle: "Yang itu nggak cocok.",
    shuffle: "Kelopaknya bergeser ke tempat baru.",
    over: "Tamannya beristirahat.",
    cell: (k, r, c) => `kelopak ${["bulat merah muda", "runcing emas", "kotak biru", "belah ketupat hijau", "bintang ungu"][k]}, baris ${r + 1}, kolom ${c + 1}`,
    chain: (n) => `Rantai x${n}`,
  },
};

export const GLYPHS = ["●", "▲", "■", "◆", "★"];
export const COLORS = ["#e59ab8", "#d9b45a", "#6f9fd8", "#74b98a", "#a98bd8"];
