// Page settings. Safe to commit: it holds no secrets.
window.POCO_CONFIG = {
  // URL of your deployed Cloudflare Worker, e.g. "https://pocomon.yourname.workers.dev".
  // Leave empty to use only the local JSON rules.
  WORKER_URL: "https://indonomon.hifebriansyah.workers.dev/",
  HISTORY_TURNS: 8,   // recent messages sent to Gemini for context
  TIMEOUT_MS: 15000,  // give up on Gemini after this long and use the local rules
};
