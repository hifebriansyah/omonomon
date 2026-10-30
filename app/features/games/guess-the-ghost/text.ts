// Tebak Hantu's own words (the TEXT table of the old guess-the-ghost.js).
import type { Lang } from "~/lib/content";
import { QUESTIONS } from "./logic";

const en = {
  q: (n: number) => `Line ${n} of ${QUESTIONS}`,
  who: "Who said this?",
  next: "Next",
  last: "Finish",
  right: "Right!",
  wrong: (name: string) => `It was ${name}.`,
  score: "Score",
  streak: "Streak",
  right_r: ["Hihi, you know them well!", "Ooh, sharp ears!", "Yes! Told you they sound like that!"],
  wrong_r: ["Ooh, tricky! Almost anybody would mix those up.", "Hmm, plot twist!", "Close! Maybe. A little."],
};

export const TEXT: Record<Lang, typeof en> = {
  en,
  id: {
    q: (n) => `Kalimat ${n} dari ${QUESTIONS}`,
    who: "Siapa yang ngomong?",
    next: "Lanjut",
    last: "Selesai",
    right: "Benar!",
    wrong: (name) => `Itu ${name}.`,
    score: "Skor",
    streak: "Beruntun",
    right_r: ["Hihi, kamu kenal mereka banget!", "Ooh, telingamu tajam!", "Nah! Kan mirip banget gayanya!"],
    wrong_r: ["Ooh, susah ya! Siapa aja bisa ketuker.", "Hmm, plot twist!", "Hampir! Mungkin. Dikit."],
  },
};
