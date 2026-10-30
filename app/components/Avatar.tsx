import type { Character } from "~/lib/content";
import { asset } from "~/lib/asset";

const SIZES = { sm: "size-9", md: "size-[52px]", lg: "size-16" } as const;

/** A ghost's round picture with her colour as the ring. `frame` adds the Candle-shop frame (--frame on <html>). */
export function Avatar({ character, size = "md", src, frame = false, className = "" }: { character: Character; size?: keyof typeof SIZES; src?: string; frame?: boolean; className?: string }) {
  return (
    <img
      src={asset(src || character.image)}
      alt=""
      className={`${SIZES[size]} flex-none rounded-full border-2 bg-paper object-contain ${className}`}
      style={{ borderColor: character.accent, boxShadow: frame ? "var(--frame, none)" : undefined }}
    />
  );
}
