// The weekly event: each week one ghost "hosts". Her games give double bond XP, and a themed quest (three runs of her games)
// pays Candles once. The host comes from the date alone (Monday to Sunday, UTC, like the leaderboards), so no server is needed;
// worker/api.js uses the same rule to have the host write about it in a whisper.

export const HOSTS = ["1", "2", "3", "4"];
export const WEEKLY_TARGET = 3;
export const WEEKLY_REWARD = 30;
const DAY = 86400_000;

// The Monday (UTC) a moment falls in, as YYYY-MM-DD.
export function weekOf(ms = Date.now()) {
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// The ghost who hosts the week of `ms`.
export function hostOf(ms = Date.now()) {
  const monday = Date.parse(weekOf(ms) + "T00:00:00Z");
  return HOSTS[Math.floor(monday / DAY / 7) % HOSTS.length];
}
