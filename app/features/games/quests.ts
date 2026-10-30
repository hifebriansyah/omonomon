// Daily quests. Everyone gets the same three each day (picked from the date, so no server is needed):
// one about chatting, one about the games, one about bond XP. Finishing at least one keeps the streak going.
import type { Character, Lang, Localized } from "~/lib/content";
import type { Progress } from "~/lib/storage";

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => fmt(new Date());
export const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fmt(d);
};
const dayIndex = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

export const ALL_DONE_BONUS = 10; // candles for finishing all three in one day

export type QuestKind = "messages" | "chatWith" | "plays" | "score" | "bondXp";
interface QuestDef {
  kind: QuestKind;
  target: number;
  reward: number;
  text: Localized;
}
export interface Quest extends QuestDef {
  id: string;
  charId?: string;
}

// kind: what is counted today (see questProgress). reward: candles.
const POOLS: QuestDef[][] = [
  [
    // chat
    { kind: "messages", target: 3, reward: 5, text: { en: "Send 3 messages", id: "Kirim 3 pesan" } },
    { kind: "chatWith", target: 2, reward: 5, text: { en: "Send 2 messages to {name}", id: "Kirim 2 pesan ke {name}" } },
    { kind: "messages", target: 5, reward: 6, text: { en: "Send 5 messages", id: "Kirim 5 pesan" } },
  ],
  [
    // games
    { kind: "plays", target: 1, reward: 4, text: { en: "Play a game", id: "Main satu game" } },
    { kind: "score", target: 100, reward: 6, text: { en: "Score 100 in a game", id: "Raih skor 100 di satu game" } },
    { kind: "plays", target: 3, reward: 6, text: { en: "Play 3 games", id: "Main 3 game" } },
    { kind: "score", target: 200, reward: 8, text: { en: "Score 200 in a game", id: "Raih skor 200 di satu game" } },
  ],
  [
    // bond
    { kind: "bondXp", target: 20, reward: 5, text: { en: "Earn 20 bond XP", id: "Dapatkan 20 XP ikatan" } },
    { kind: "bondXp", target: 30, reward: 6, text: { en: "Earn 30 bond XP", id: "Dapatkan 30 XP ikatan" } },
    { kind: "bondXp", target: 40, reward: 8, text: { en: "Earn 40 bond XP", id: "Dapatkan 40 XP ikatan" } },
  ],
];

// The three quests for a date. `characters` is the list from characters.json (a chatWith quest picks one by the date).
export function todaysQuests(characters: readonly Pick<Character, "id">[] | null | undefined, date = today()): Quest[] {
  const n = dayIndex(date);
  return POOLS.map((pool, slot) => {
    const i = (n + slot) % pool.length;
    const q: Quest = { ...pool[i], id: `q${slot}${i}` };
    if (q.kind === "chatWith" && characters?.length) q.charId = characters[n % characters.length].id;
    return q;
  });
}

// How far today's counters have got for a quest.
export function questProgress(q: Pick<Quest, "kind" | "charId">, daily: Partial<Progress["daily"]>): number {
  switch (q.kind) {
    case "messages":
      return daily.messages || 0;
    case "chatWith":
      return (daily.chatWith || {})[q.charId ?? ""] || 0;
    case "plays":
      return daily.plays || 0;
    case "score":
      return daily.topScore || 0;
    case "bondXp":
      return daily.bondXp || 0;
    default:
      return 0;
  }
}

export function questLabel(q: Pick<Quest, "text" | "charId">, lang: Lang, characters: readonly Pick<Character, "id" | "name">[] | null | undefined): string {
  const name = characters?.find((c) => c.id === q.charId)?.name || "";
  return (q.text[lang] || q.text.en).replace("{name}", name);
}
