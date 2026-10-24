// WhatsApp-style times and day labels, shared by the history panel and the chat list.
// They follow the visitor's browser language and clock format
// (an Indonesian browser gets "Hari ini", "Kemarin" and 24-hour times).
export const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
export const dayKey = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function dayLabel(t) {
  const day = new Date(t);
  const now = new Date();
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = Math.round((midnight(now) - midnight(day)) / 86400000);
  if (daysAgo === 0 || daysAgo === 1) {
    const word = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-daysAgo, "day"); // today / yesterday
    return word.charAt(0).toLocaleUpperCase() + word.slice(1);
  }
  if (daysAgo > 1 && daysAgo < 7) return day.toLocaleDateString(undefined, { weekday: "long" });
  const sameYear = day.getFullYear() === now.getFullYear();
  return day.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

// What the chat list shows next to a chat: the time today, otherwise the day label ("Yesterday", "Monday", "12 Oct").
export function chatTime(t) {
  return dayKey(t) === dayKey(Date.now()) ? timeFormat.format(t) : dayLabel(t);
}
