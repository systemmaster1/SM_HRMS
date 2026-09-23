// SM HRMS service worker.
// v2: caches ONLY versioned static files. Pages and Next.js data requests
// (?_rsc=...) always come from the network, so HR data is never stale.
const CACHE = "sm-hrms-static-v2";
const PRECACHE = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/logo-full.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  PRECACHE.includes(url.pathname) ||
  /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations: network first, offline fallback to the login screen.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/login")));
    return;
  }

  // Everything that is not a static asset (API, RSC payloads, downloads): network only.
  if (!isStatic(url) || url.search.includes("_rsc")) return;

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
  );
});
