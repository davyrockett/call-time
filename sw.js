// Service worker: saves the app's files on the phone so it opens with no signal.
//
// IMPORTANT: whenever any file below changes, bump VERSION (tools/bump.sh).
// That is how phones learn there's an update to download.
const VERSION = 'v2';
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
    caches.open(CACHE).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
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
  // Calendar files made by the app: a real web address that answers with the calendar file
  // (the text is in ?d=), because iPhones only open calendar files that come from a web address.
  if (url.pathname.endsWith('/cal/plan.ics')) {
    event.respondWith(new Response(url.searchParams.get('d') || '', {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="Call Time.ics"' },
    }));
    return;
  }
  // Opening the app itself (not a file like a calendar file) always gets the saved page.
  if (request.mode === 'navigate' && !/\.(ics|txt)$/.test(url.pathname)) {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)));
});
