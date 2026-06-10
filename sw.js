/* Nyxora Library service worker
 * - Pre-caches the app shell so the installed PWA works offline.
 * - Stale-while-revalidate for paths.json (instant load, refresh in background).
 * - Network-first for navigations, falling back to the cached shell.
 * Bump CACHE_VERSION whenever the shell assets change.
 */
const CACHE_VERSION = 'nyxora-v4';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './translations.js',
  './manifest.json',
  './logo.png',
  './BG.png',
  './404.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

function isShellAsset(url) {
  return SHELL_ASSETS.some((a) => url.pathname.endsWith(a.replace('./', '/')) || url.pathname.endsWith(a.replace('./', '')));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Only handle same-origin requests; remote assets (raw.githubusercontent, fonts, AI) pass through.
  if (url.origin !== self.location.origin) return;

  // paths.json → stale-while-revalidate
  if (url.pathname.endsWith('/paths.json')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => null);
        return cached || network || new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // Navigations → network-first, fall back to cached shell (offline support)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Shell assets → cache-first with background refresh
  if (isShellAsset(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
