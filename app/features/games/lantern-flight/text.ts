import type { Lang } from "~/lib/content";

export const TEXT: Record<Lang, { score: string; flames: string; tap: string; moon: string; end: string; btn: string }> = {
  en: {
    score: "Wishes",
    flames: "Flames",
    tap: "Touch and hold to drift right, let go to drift left. Touch to begin.",
    moon: "The moon",
    end: "...",
    btn: "Hold to drift right",
  },
  id: {
    score: "Harapan",
    flames: "Api",
    tap: "Tahan untuk melayang ke kanan, lepas untuk ke kiri. Sentuh untuk mulai.",
    moon: "Bulan",
    end: "...",
    btn: "Tahan untuk ke kanan",
  },
};
