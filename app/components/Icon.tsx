// Lucide icons (ISC License) from lucide-react, drawn the way the old site drew its copied SVGs: 1.5em, stroke 2.2.
import type { LucideIcon, LucideProps } from "lucide-react";

export function Icon({ as: Glyph, className = "", ...rest }: { as: LucideIcon } & LucideProps) {
  return <Glyph aria-hidden="true" focusable="false" strokeWidth={2.2} className={`size-[1.5em] flex-none ${className}`} {...rest} />;
}
