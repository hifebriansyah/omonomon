// Tali Lepas's own words (the TEXT table of the old rope-untangle.js).
import type { Lang } from "~/lib/content";

const en = {
  time: (s: number) => `${s}s`,
  score: (n: number) => `${n} pts`,
  level: (n: number) => `Level ${n}`,
  skip: "Skip level (-5)",
  hint: "Drag the knots until no rope crosses.",
  ok: (g: number) => `Untangled! +${g}`,
  skipped: "Skipped.",
  board: "Rope board: drag the knots",
  knot: (i: number) => `Knot ${i}`,
  start: "Tap Start. Drag the knots until no ropes cross.",
  go: "Start",
  clock: (s: string) => `Level clock: ${s}s left for the bonus`,
};

export const TEXT: Record<Lang, typeof en> = {
  en,
  id: {
    time: (s) => `${s} dtk`,
    score: (n) => `${n} poin`,
    level: (n) => `Level ${n}`,
    skip: "Lewati level (-5)",
    hint: "Seret simpulnya sampai tidak ada tali yang bersilang.",
    ok: (g) => `Terurai! +${g}`,
    skipped: "Dilewati.",
    board: "Papan tali: seret simpulnya",
    knot: (i) => `Simpul ${i}`,
    start: "Ketuk Mulai. Seret simpulnya sampai tidak ada tali bersilang.",
    go: "Mulai",
    clock: (s) => `Jam level: sisa ${s} dtk untuk bonus`,
  },
};
