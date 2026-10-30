// Uji Nyali's own words for the page around the story (the TEXT table of the old dare-night.js; the story is in logic.ts).
import type { Lang } from "~/lib/content";

export const TEXT: Record<Lang, { pick: string; lvl: string; go: string; next: string; fin: string; route: string; ending: string }> = {
  en: { pick: "Who walks with you tonight?", lvl: "bond Lv", go: "Start the walk", next: "Continue", fin: "See the result", route: "Tonight's route", ending: "Ending" },
  id: { pick: "Siapa yang menemanimu malam ini?", lvl: "ikatan Lv", go: "Mulai jalan", next: "Lanjut", fin: "Lihat hasil", route: "Rute malam ini", ending: "Akhir" },
};
