// Small helpers shared by the other modules.

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Keep in sync with normalize() in build.py.
export const tokenize = (text) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ").split(/\s+/).filter(Boolean);

const encoder = new TextEncoder();

// Keep in sync with fnv1a() in build.py.
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const b of encoder.encode(text)) h = Math.imul(h ^ b, 0x01000193);
  return h >>> 0;
}
