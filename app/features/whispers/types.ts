// The shapes the API Worker sends for whispers and comments (shapeWhisper and shapeComment in worker/api.js).
// Both languages always come together; the page picks one (text[lang], falling back to English).

export interface WhisperLink {
  url: string;
  title?: string | null;
  source?: string | null;
  thumb?: string | null;
}

export interface Whisper {
  n: number;
  ghost: string; // character id
  t: number; // ms since 1970
  comments?: number;
  loves?: number;
  text: { en: string; id: string | null };
  link?: WhisperLink | null;
}

export interface WhisperComment {
  n: number;
  kind: "user" | "ghost";
  author?: string | null;
  ghost?: string | null; // a ghost's comment: which ghost wrote it (may be another than the whisper's)
  replyTo?: number | null;
  body: string;
  bodyId?: string | null;
  deleted?: boolean;
  t: number;
}

export interface WhisperPage {
  whispers: Whisper[];
  more: boolean;
}
