// Offline support: precache the app shell, then network-first for everything else under this origin
// so a deploy is picked up immediately when online and the last good copy is served offline.
// VERSION and CORE are replaced at build time by scripts/build.mjs (from deploy-files.json).
// In local development CORE is empty, so only the network-first runtime cache is active.
const VERSION = 'igo-dev';
const CORE = [];
self.addEventListener('install', (event) => {
  // addAll is atomic: if any file fails, install fails and the previous worker keeps serving.
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request, { ignoreSearch: false })
          .then((hit) => hit || caches.match(request, { ignoreSearch: true }))
          .then((hit) => hit || Response.error())
      )
  );
});
