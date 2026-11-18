// Service worker: saves the app's files on the phone so it opens with no signal.
//
// IMPORTANT: whenever any file below changes, bump VERSION (tools/bump.sh).
// That is how phones learn there's an update to download.
const VERSION = 'v10';
const CACHE = `calltime-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './move.js',
  './suite.js',
  './share.js',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // Each file is fetched with ?sw=<version> on the end. GitHub's servers keep old copies for up to
    // 10 minutes after an update; a new address has no old copy, so the phone never saves a stale file.
    caches.open(CACHE).then((cache) => Promise.all(ASSETS.map(async (url) => {
      const res = await fetch(new Request(`${url}${url.includes('?') ? '&' : '?'}sw=${VERSION}`, { cache: 'reload' }));
      if (!res.ok) throw new Error(`Couldn't download ${url}`);
      await cache.put(url, res);
    })))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('calltime-') && key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// The page sends this when you tap "Update".
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Serve from the saved copy first; only go to the network for things we don't have.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  // Opening the app itself (not a file like a calendar file) always gets the saved page.
  // Other pages (like help/guide.html) come from the saved copy or the network as they are.
  if (request.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname)) {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)));
});
