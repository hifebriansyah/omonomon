// Omon Omon service worker, served at <BASE_PATH>sw.js: the same address as the old one, so browsers update it in place.
// scripts/postbuild.ts fills in VERSION, PRECACHE (Workbox's list of the build: hashed scripts, styles, pre-rendered pages, data)
// and API_URL. Plain JavaScript on purpose: it is copied, not bundled.
// - install: save every precached file, then take over at once (the page shows "a new version is ready", see UpdatePrompt.tsx)
// - activate: delete every older "omon-" cache, the old site's included
// - pages: the network first, so a deploy shows at once; the saved page when offline
// - everything else from this site: the saved copy first (hashed and versioned addresses never change)
// - Web Push: the push carries no text; the API keeps it for this browser, found by the SHA-256 of its push endpoint

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const API = "__API_URL__";
const CACHE = `omon-${VERSION}`;
const scope = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(scope(url)).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("omon-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return; // the API, Google and Gemini are never cached
  if (url.pathname.startsWith(new URL(scope("storybook/")).pathname)) return; // Storybook is never cached

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
          return (await caches.match(request)) || (await caches.match(new URL(path, url))) || (await caches.match(scope("./"))) || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});

async function endpointHash() {
  const sub = await self.registration.pushManager.getSubscription();
  if (!sub) return null;
  const bytes = new TextEncoder().encode(sub.endpoint);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let message = null;
      try {
        const hash = await endpointHash();
        if (hash && API) message = (await (await fetch(`${API.replace(/\/+$/, "")}/push/latest?e=${hash}`)).json()).message;
      } catch {}
      if (!message) return; // nothing to say: show nothing
      await self.registration.showNotification(String(message.title || "Omon Omon").slice(0, 80), {
        body: String(message.body || "").slice(0, 160),
        icon: scope("build/img/icon-192.png"),
        data: { url: String(message.url || "") },
        tag: "omon",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = scope(event.notification.data?.url || "");
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const c of list)
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      return clients.openWindow(target);
    }),
  );
});
