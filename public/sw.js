/* Service worker: caches OUR static assets only.
 * Never touches the radio stream, embeds, map tiles or any cross-origin request. */
const VERSION = 'v6';
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const PRECACHE = ['/', '/policies/', '/manifest.webmanifest', '/favicon-32.png', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Same-origin GETs only. Streams (.m3u8/.aac), embeds, tiles, fonts → straight to network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/\.(m3u8|aac|ts|mp3)$/i.test(url.pathname) || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    // Network first so content stays fresh; cached page when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Hashed build assets and icons: cache first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.endsWith('.svg')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
