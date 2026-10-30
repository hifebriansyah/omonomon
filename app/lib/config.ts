// Page settings (was config.js / window.POCO_CONFIG). All public by design; the values come from .env.production.
const env = import.meta.env;
const num = (v: string | undefined, fallback: number) => (Number.isFinite(Number(v)) && v !== "" && v !== undefined ? Number(v) : fallback);
const trimSlash = (v: string | undefined) => (v || "").replace(/\/+$/, "");

export const config = {
  /** The Gemini Worker, without a trailing slash. Empty: only the local rules answer. */
  WORKER_URL: trimSlash(env.VITE_WORKER_URL),
  GOOGLE_CLIENT_ID: env.VITE_GOOGLE_CLIENT_ID || "",
  /** The API Worker, without a trailing slash. Empty: progress stays in this browser. */
  API_URL: trimSlash(env.VITE_API_URL),
  TURNSTILE_SITE_KEY: env.VITE_TURNSTILE_SITE_KEY || "",
  VAPID_PUBLIC_KEY: env.VITE_VAPID_PUBLIC_KEY || "",
  INPUT_MAX_CHARS: num(env.VITE_INPUT_MAX_CHARS, 200),
  HISTORY_TURNS: num(env.VITE_HISTORY_TURNS, 8),
  TIMEOUT_MS: num(env.VITE_TIMEOUT_MS, 15000),
} as const;

export type Config = typeof config;
