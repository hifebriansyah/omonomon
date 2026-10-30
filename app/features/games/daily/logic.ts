// Daily Challenge: the same seeded run for everyone each day, alternating between Hop Hop and Hair Catch.
// Pure helpers (tests/legacy/daily-and-riddles.test.mjs is the spec).

export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dateString = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const seedOf = (date: string): number =>
  [...date].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

export function todaysPick(date = dateString()): { game: "hop-hop" | "hair-catch"; char: string } {
  const parts = date.split("-").map(Number);
  const day = Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
  return day % 2 === 0 ? { game: "hop-hop", char: "1" } : { game: "hair-catch", char: "4" };
}
