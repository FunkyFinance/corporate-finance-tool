/* Service worker — offline support for the Corporate Finance Tool.
   - Static assets: cache-first (rock-solid offline), network fallback.
   - Navigations: network-first (fresh HTML when online) → cached shell offline.
   - Resilient install: one missing file can't abort the whole cache. */
const CACHE = 'cft-v11';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './proforma.js', './finalreport.js', './stocks.js', './ddm.js', './capm.js', './isolver.js', './search.js',
  './vendor/jszip.min.js', './vendor/jspdf.umd.min.js', './vendor/jspdf.plugin.autotable.min.js',
  './template.xlsx', './finalreport_template.xlsx', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache each asset individually so a single failure doesn't abort the rest
    await Promise.allSettled(ASSETS.map((a) => c.add(a)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // App-shell navigations: try network, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE); c.put(req, net.clone());
        return net;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Everything else: cache-first (works offline), then network (and cache it).
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      const c = await caches.open(CACHE); c.put(req, net.clone());
      return net;
    } catch (_) {
      return cached; // undefined → genuine miss while offline
    }
  })());
});
