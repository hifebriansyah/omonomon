// The time of day in Jakarta (UTC+7), in four parts. It tints the chat stage (data-tod on <html>) and is sent to Gemini so the
// ghost's mood fits the hour: spookier at night, sleepy by day.

export function todOf(now = Date.now()) {
  const h = new Date(now + 7 * 3600_000).getUTCHours();
  return h >= 21 || h < 5 ? "night" : h < 11 ? "morning" : h < 18 ? "day" : "evening";
}
