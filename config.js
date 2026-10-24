// Page settings. Safe to commit: it holds no secrets.
window.POCO_CONFIG = {
  // URL of your deployed Cloudflare Worker, e.g. "https://pocomon.yourname.workers.dev".
  // Leave empty to use only the local JSON rules.
  WORKER_URL: "https://geminimon.securhat.com/",
  // Google sign-in (Google Cloud > Google Auth Platform > Clients). The client ID is public by design;
  // the client secret is never used and must never be put here.
  GOOGLE_CLIENT_ID: "620395952409-mv96o61s4ep74n5vuohqvvk23tvt0i6p.apps.googleusercontent.com",
  // The API Worker (worker/api.js): Google sign-in and saved game progress. Leave empty to keep progress in this
  // browser only; the sign-in button then stays off.
  API_URL: "https://apimon.securhat.com",
  INPUT_MAX_CHARS: 200, // longest message a visitor can send (saves tokens)
  HISTORY_TURNS: 8,   // recent messages sent to Gemini for context
  TIMEOUT_MS: 15000,  // give up on Gemini after this long and use the local rules
};
