// Teka-Teki Gaib (Ghost Riddles): three riddles a day, each from a different ghost.
// Pure data and matching rules (tests/legacy/daily-and-riddles.test.mjs is the spec).
import { getJson, KEYS, type RiddleDone, setJson } from "~/lib/storage";

export const SCORE_EACH = 30;
export const PER_DAY = 3;

export interface Riddle {
  ghost: string;
  en: string;
  id: string;
  answers: string[];
}

export const RIDDLES: Riddle[] = [
  { ghost: "1", en: "I am tied at the top and tied at the bottom, and I still cannot walk. Who am I?", id: "Aku diikat di atas dan diikat di bawah, tapi tetap nggak bisa jalan. Siapa aku?", answers: ["pocong", "pocomon", "a pocong", "hantu pocong"] },
  { ghost: "1", en: "The more of me you take, the more you leave behind. What am I?", id: "Makin banyak kamu ambil aku, makin banyak yang kamu tinggalkan. Apa aku?", answers: ["footsteps", "steps", "langkah", "jejak", "langkah kaki"] },
  { ghost: "1", en: "What has to be broken before you can use it?", id: "Apa yang harus dipecahkan dulu sebelum bisa dipakai?", answers: ["egg", "an egg", "telur"] },
  { ghost: "2", en: "I have hands but I cannot clap. What am I?", id: "Aku punya tangan tapi nggak bisa tepuk tangan. Apa aku?", answers: ["clock", "a clock", "jam", "jam dinding"] },
  { ghost: "2", en: "I am full of holes and still hold water. What am I?", id: "Aku penuh lubang tapi tetap bisa nahan air. Apa aku?", answers: ["sponge", "a sponge", "spons", "busa"] },
  { ghost: "2", en: "What goes up when the rain comes down?", id: "Apa yang naik waktu hujan turun?", answers: ["umbrella", "an umbrella", "payung"] },
  { ghost: "3", en: "What falls but never breaks, and what breaks but never falls?", id: "Apa yang jatuh tapi nggak pernah pecah, dan apa yang pecah tapi nggak pernah jatuh?", answers: ["night and day", "day and night", "malam dan siang", "malam dan pagi", "siang dan malam"] },
  { ghost: "3", en: "I follow you in the sun and vanish in the dark. What am I?", id: "Aku mengikutimu saat terang dan hilang saat gelap. Apa aku?", answers: ["shadow", "your shadow", "bayangan", "bayang"] },
  { ghost: "3", en: "I speak without a mouth and answer without ears. What am I?", id: "Aku bicara tanpa mulut dan menjawab tanpa telinga. Apa aku?", answers: ["echo", "an echo", "gema", "echo gema"] },
  { ghost: "4", en: "If you tell me, I am no longer mine, yet everyone wants me. What am I?", id: "Kalau kamu ceritakan, aku bukan milikku lagi, tapi semua orang mau. Apa aku?", answers: ["secret", "a secret", "rahasia"] },
  { ghost: "4", en: "I have keys but no locks, and space but no room. What am I?", id: "Aku punya tuts tapi nggak punya gembok, punya spasi tapi nggak punya ruangan. Apa aku?", answers: ["keyboard", "a keyboard", "papan ketik", "keyboard komputer"] },
  { ghost: "4", en: "What has a head and a tail but no body?", id: "Apa yang punya kepala dan ekor tapi nggak punya badan?", answers: ["coin", "a coin", "koin", "uang logam", "uang koin"] },
];

export const LINES: Record<string, { ok: { en: string; id: string }; no: { en: string; id: string } }> = {
  "1": { ok: { en: "Hm. Correct. Do not get used to it.", id: "Hm. Benar. Jangan kebiasaan." }, no: { en: "No. Think harder, it hurts less than being wrong.", id: "Salah. Mikir lagi, lebih nggak sakit daripada salah." } },
  "2": { ok: { en: "Right! One less thing on my list.", id: "Benar! Satu urusan beres." }, no: { en: "Not quite. I would explain, but I have rounds.", id: "Belum tepat. Aku jelasin, tapi aku harus keliling." } },
  "3": { ok: { en: "Yes... that is it. How lovely.", id: "Iya... itu dia. Indah ya." }, no: { en: "Not this time. That is alright.", id: "Bukan kali ini. Nggak apa-apa." } },
  "4": { ok: { en: "You got it! How did you know?!", id: "Kamu bener! Kok bisa tau?!" }, no: { en: "Ooh, close, or not. I will not say.", id: "Ooh, hampir, atau enggak. Nggak kukasih tau." } },
};

export const normalize = (s: unknown): string =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const matches = (riddle: Riddle, guess: unknown): boolean => {
  const g = normalize(guess);
  return Boolean(g) && riddle.answers.some((a) => normalize(a) === g);
};

// The day's three riddles: one from each of three different ghosts, picked by the date (the same for everyone).
export function dailyRiddles(date: string): Riddle[] {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const ghosts = ["1", "2", "3", "4"];
  const skip = ghosts[day % 4];
  return ghosts
    .filter((g) => g !== skip)
    .map((g, i) => {
      const mine = RIDDLES.filter((r) => r.ghost === g);
      return mine[(day + i) % mine.length];
    });
}

export const dateString = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const doneToday = (date: string): RiddleDone | null => {
  const v = getJson<RiddleDone>(KEYS.riddleDone);
  return v?.date === date ? v : null;
};

export const markDone = (date: string, score: number): void => {
  setJson(KEYS.riddleDone, { date, score });
};
