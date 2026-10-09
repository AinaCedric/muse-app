// Cache de l'interface (l'app s'ouvre même hors-ligne). Les appels GitHub ne sont jamais mis en cache.
const CACHE = 'muse-v34';
const SHELL = ['./', './index.html', './app.js', './automations.js', './manifest.webmanifest', './icon.svg', './avatar.js', './vendor/three.min.js', './vendor/jszip.min.js', './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css', './vendor/maplibre/maplibre-gl.js', './vendor/maplibre/maplibre-gl.css'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((x) => new Request(x, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { if (!u.search) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
