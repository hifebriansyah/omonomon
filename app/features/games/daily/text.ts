import type { Lang } from "~/lib/content";

export const TEXT: Record<
  Lang,
  {
    head: (title: string) => string;
    same: string;
    games: { "hop-hop": string; "hair-catch": string };
    start: string;
  }
> = {
  en: {
    head: (title) => `Today: ${title}`,
    same: "Same run for everyone today",
    games: { "hop-hop": "Hop Hop", "hair-catch": "Hair Catch" },
    start: "Tap or press Space to start",
  },
  id: {
    head: (title) => `Hari ini: ${title}`,
    same: "Rintangan sama untuk semua orang hari ini",
    games: { "hop-hop": "Hop Hop", "hair-catch": "Hair Catch" },
    start: "Tap atau tekan Spasi untuk mulai",
  },
};
