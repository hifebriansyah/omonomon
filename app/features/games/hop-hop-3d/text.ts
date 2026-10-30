import type { Lang } from "~/lib/content";

export const TEXT: Record<Lang, { hint: string; best: string; fall: string }> = {
  en: {
    hint: "Swipe or arrows to change lane. Tap or Space to hop. Do not hop under branches.",
    best: "Best",
    fall: "Tap or press Space to hop",
  },
  id: {
    hint: "Geser atau panah untuk pindah jalur. Tap atau Spasi untuk lompat. Jangan lompat di bawah dahan.",
    best: "Terbaik",
    fall: "Tap atau tekan Spasi untuk melompat",
  },
};
