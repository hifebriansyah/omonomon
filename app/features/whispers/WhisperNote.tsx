// A plain thought (a whisper with no link or picture) is shown as a square sticky note: pastel paper, white text. The paper colour is
// the ghost's own (a softened version of her accent, deep enough for white letters), so the colour tells who wrote it; the text stays
// real text (copyable, readable by screen readers). The paper, tape, patterns and tears are in whispers.css.
import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { Character } from "~/lib/content";
import "./whispers.css";

const NOTE_COLORS: Record<string, string> = { pocomon: "#a07fd6", ngesomon: "#e2707f", sundemon: "#d99a3a", kuntimon: "#4db58a" };

export function WhisperNote({ n, text, to, ghost }: { n: number; text: string; to?: string; ghost?: Pick<Character, "slug" | "accent"> | null }) {
  const slug = ghost?.slug || "";
  const className = /^[a-z]+$/.test(slug) ? `w-note w-note-${slug}` : "w-note"; // her own pattern on the paper
  const style = { "--note": NOTE_COLORS[slug] || ghost?.accent || "#8d9ae8", "--tilt": `${(Number(n) || 0) % 2 ? -0.7 : 0.6}deg` } as CSSProperties;
  const size = text.length <= 50 ? "s" : text.length <= 100 ? "m" : "l"; // short thoughts get bigger letters
  const body = (
    <>
      {slug === "sundemon" && (
        // her note cries: three slow tear drops fall behind the words (drawn by CSS only)
        <span className="w-note-tears" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <span className="w-note-text">{text}</span>
    </>
  );
  return to ? (
    <Link to={to} className={className} style={style} data-size={size}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style} data-size={size}>
      {body}
    </div>
  );
}
