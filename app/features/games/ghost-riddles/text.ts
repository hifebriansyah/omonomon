import type { Lang } from "~/lib/content";

export const TEXT: Record<
  Lang,
  {
    head: string;
    answer: string;
    send: string;
    thinking: string;
    of: (n: number, t: number) => string;
    limit: string;
    error: string;
    done: (s: number) => string;
    again: string;
    next: string;
    finish: string;
  }
> = {
  en: {
    head: "Ghost Riddles",
    answer: "Your answer",
    send: "Answer",
    thinking: "...",
    of: (n, t) => `Riddle ${n} of ${t}`,
    limit: "That is all the riddles for today. Come back tomorrow.",
    error: "The ghosts could not hear you. Try again in a moment.",
    done: (s) => `Today's riddles are done: ${s} points`,
    again: "Today's riddles are already answered. Come back tomorrow.",
    next: "Next",
    finish: "Finish",
  },
  id: {
    head: "Teka-Teki Gaib",
    answer: "Jawabanmu",
    send: "Jawab",
    thinking: "...",
    of: (n, t) => `Teka-teki ${n} dari ${t}`,
    limit: "Teka-teki hari ini sudah habis. Balik lagi besok.",
    error: "Para hantu nggak dengar. Coba lagi sebentar.",
    done: (s) => `Teka-teki hari ini selesai: ${s} poin`,
    again: "Teka-teki hari ini sudah dijawab. Balik lagi besok.",
    next: "Lanjut",
    finish: "Selesai",
  },
};
