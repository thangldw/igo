// Offline support: precache the app shell, then network-first for everything else under this origin
// so a deploy is picked up immediately when online and the last good copy is served offline.
const VERSION = 'igo-v1';
const CORE = ['./', './index.html', './train.html', './review.html', './style.css', './train.css', './review.css', './workspace.css', './app.js', './train.js', './review.js', './engine.js', './lessons.js', './curriculum.js', './study-state.js', './reading.js', './reading-worker.js', './reading-bank.json', './sgf.js', './terms.js', './game-record.js', './area-score.js', './search-engine.js', './search-worker.js', './symmetry.js', './dead-stones.js', './ogs.js', './backup.js', './footer.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(VERSION).then(cache => cache.put(request, copy)); }
    return response;
  }).catch(() => caches.match(request, { ignoreSearch: false }).then(hit => hit || caches.match(request, { ignoreSearch: true })).then(hit => hit || Response.error())));
});
