// WhatsApp-style times and day labels, shared by the history panel and the chat list (was assets/scripts/time.js).
// They follow the page language: "Hari ini", "Kemarin" and 24-hour times in Indonesian; in English the browser's own format.
// Browser only (they depend on the visitor's clock and locale): call them after hydration.
import type { Lang } from "./content";

const locale = (lang: Lang) => (lang === "id" ? "id-ID" : undefined);
const formats = new Map<Lang, Intl.DateTimeFormat>();
export const timeFormat = (lang: Lang) => {
  let f = formats.get(lang);
  if (!f) formats.set(lang, (f = new Intl.DateTimeFormat(locale(lang), { hour: "2-digit", minute: "2-digit" })));
  return f;
};

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function dayLabel(t: number, lang: Lang): string {
  const day = new Date(t);
  const now = new Date();
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((midnight(now) - midnight(day)) / 86400000);
  if (daysAgo === 0 || daysAgo === 1) {
    const word = new Intl.RelativeTimeFormat(locale(lang), { numeric: "auto" }).format(-daysAgo, "day"); // today / yesterday
    return word.charAt(0).toLocaleUpperCase() + word.slice(1);
  }
  if (daysAgo > 1 && daysAgo < 7) return day.toLocaleDateString(locale(lang), { weekday: "long" });
  const sameYear = day.getFullYear() === now.getFullYear();
  return day.toLocaleDateString(locale(lang), { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** What the chat list shows next to a chat: the time today, otherwise the day label ("Yesterday", "Monday", "12 Oct"). */
export function chatTime(t: number, lang: Lang): string {
  return dayKey(t) === dayKey(Date.now()) ? timeFormat(lang).format(t) : dayLabel(t, lang);
}
