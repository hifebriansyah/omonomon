// The engine's changing data (was part of assets/scripts/state.js). One per page load: the chat language,
// the Gemini context per ghost and the failure count are shared by every chat.
import type { Turn } from "./types";

export const engine = {
  lastLang: undefined as string | undefined, // language the chat is in right now ("en" | "id")
  histories: {} as Record<string, Turn[]>, // character id -> context sent to Gemini
  failures: 0, // Gemini failures in a row (not counting "too many requests"); resets on a success
};

/** Pick the text for the chat language out of {en: "...", id: "..."}. */
export const inLang = <T>(obj: Partial<Record<string, T>> | undefined | null): T | undefined => (engine.lastLang ? obj?.[engine.lastLang] : undefined) || obj?.en;

/** Tests and stories: start again from nothing. */
export function resetEngine() {
  engine.lastLang = undefined;
  engine.histories = {};
  engine.failures = 0;
}
