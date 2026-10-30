// Obat Malam's own words (the TEXT table of the old night-meds.js).
import type { Lang } from "~/lib/content";

const en = {
  score: "Score",
  lives: (n: number) => `${n} ${n === 1 ? "life" : "lives"} left`,
  tray: ["Bed 1, red circle", "Bed 2, blue square", "Bed 3, yellow triangle"],
  hint: "Tap the matching bed (or press 1, 2, 3)",
  ok: ["Good", "Fed", "Checked"],
  bad: "Wrong bed!",
  miss: "Missed one!",
  streak: (n: number) => `Streak ${n}`,
  pill: ["red circle pill", "blue square pill", "yellow triangle pill"],
};

export const TEXT: Record<Lang, typeof en> = {
  en,
  id: {
    score: "Skor",
    lives: (n) => `Sisa ${n} nyawa`,
    tray: ["Ranjang 1, lingkaran merah", "Ranjang 2, kotak biru", "Ranjang 3, segitiga kuning"],
    hint: "Ketuk ranjang yang cocok (atau tekan 1, 2, 3)",
    ok: ["Bagus", "Sudah minum", "Beres"],
    bad: "Salah ranjang!",
    miss: "Ada yang lolos!",
    streak: (n) => `Beruntun ${n}`,
    pill: ["pil lingkaran merah", "pil kotak biru", "pil segitiga kuning"],
  },
};

export const COLORS = ["#e5484d", "#3e7bfa", "#f2c230"];
export const SHAPES = ["●", "■", "▲"];
