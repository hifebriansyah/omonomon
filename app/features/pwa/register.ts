// Registers the service worker (<BASE_PATH>sw.js, written by scripts/postbuild.ts from sw.template.js) so the app and its
// games open without a network, and tells the page when a new version took over.
// Skipped where workers are not available (plain http, older browsers) and outside the built site: `react-router dev`
// has no sw.js, and Storybook never renders the real UpdatePrompt. Nothing runs at import time.

const BASE = import.meta.env.BASE_URL;
const SW_URL = `${BASE}sw.js`;

/** True where the worker can and should be registered. */
export function canRegister(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false; // dev server: no sw.js, and a cached worker would hide edits
  return location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

let started = false;

/**
 * Register once per visit. `onUpdate` runs when a NEW worker takes control of a page that already had one (the worker calls
 * skipWaiting and clients.claim itself, so it is already serving the new files). A first install calls nothing.
 */
export function registerServiceWorker(onUpdate: () => void): void {
  if (started || !canRegister()) return;
  started = true;
  const hadController = Boolean(navigator.serviceWorker.controller); // the old site's worker counts: its page gets the prompt too
  import("workbox-window")
    .then(({ Workbox }) => {
      const wb = new Workbox(SW_URL, { scope: BASE });
      wb.addEventListener("controlling", (event) => {
        if (event.isUpdate || hadController) onUpdate();
      });
      // Another tab may have installed the update: this page then only sees the controller change.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController) onUpdate();
      });
      return wb.register();
    })
    .catch(() => {}); // the app works the same without it
}

/**
 * The active registration for this site, or null when there is none within a few seconds (plain http, dev server, the
 * worker failed to install). navigator.serviceWorker.ready alone would wait forever then. Push subscriptions use it.
 */
export async function readyRegistration(waitMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  let stop: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => (stop = setTimeout(() => resolve(null), waitMs)));
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(stop);
  }
}
