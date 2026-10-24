// Offline shell. Built by tools/make_site.py, which fills in VERSION (the hash of the scripts, styles and data) and PRECACHE
// (the pages, scripts, styles and data files of this build). A deploy that changes any of them changes this file, so the browser
// installs the new worker and drops the old cache. Pictures and rule shards are saved the first time they are used.

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `omon-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("omon-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return; // the API, Google and Gemini are never cached

  if (request.mode === "navigate") { // pages: the network first, so a deploy shows at once; the saved page when offline
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(new URL("./", self.registration.scope))) || Response.error())
    );
    return;
  }

  event.respondWith( // scripts, styles, data and pictures: the saved copy first (versioned addresses never change)
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
      return res;
    }))
  );
});

// ---- Web Push ----
// The push carries no text. The API keeps the text for this browser, found by the SHA-256 of its push endpoint.
const API = "__API_URL__";

async function endpointHash() {
  const sub = await self.registration.pushManager.getSubscription();
  if (!sub) return null;
  const bytes = new TextEncoder().encode(sub.endpoint);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let message = null;
    try {
      const hash = await endpointHash();
      if (hash && API) message = (await (await fetch(`${API.replace(/\/+$/, "")}/push/latest?e=${hash}`)).json()).message;
    } catch {}
    if (!message) return; // nothing to say: show nothing
    await self.registration.showNotification(String(message.title || "Omon Omon").slice(0, 80), {
      body: String(message.body || "").slice(0, 160),
      icon: new URL("builds/img/icon-192.png", self.registration.scope).href,
      data: { url: String(message.url || "") },
      tag: "omon",
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "", self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: "window" }).then((list) => {
    for (const c of list) if ("focus" in c) { c.navigate(target); return c.focus(); }
    return clients.openWindow(target);
  }));
});
