// Shapes the chat engine works with.
import type { Localized } from "~/lib/content";

/** One turn of the context sent to Gemini. */
export interface Turn {
  role: "user" | "model";
  text: string;
}

/** What getReply() gives. `error` is true for a line that is not a real answer (too many requests, something broke). */
export interface Reply {
  text: string;
  error?: boolean;
}

/** The fields of a character the engine reads (characters.json). */
export interface Speaker {
  id: string;
  busy: Localized<string[]>;
  greeting?: Localized;
  fallback?: Localized<string[]>;
}

/** Extra context for Gemini, filled in by the page (the engine knows nothing about progress or accounts). */
export interface GeminiContext {
  bond?: number; // how close the player is to this ghost (1 to 10); the Worker lets it colour her tone
  tod?: string; // the hour in Jakarta: the ghost's mood follows it
  memory?: string; // signed-in players: what she remembers about them
}
