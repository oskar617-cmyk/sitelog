// SiteLog Service Worker
// Strategy: network-first for HTML/JS (always get latest), cache-first for icons
const CACHE_VERSION = 'sitelog-v8';
const CORE_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache core files but don't fail if some are missing
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.allSettled(CORE_CACHE.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// Activate: clear old caches, take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for our own files, pass-through for everything else
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle GET requests on our own origin
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  // Never cache or intercept Microsoft / Graph / Nominatim API calls
  if (url.hostname.includes('microsoft') || url.hostname.includes('graph.') ||
      url.hostname.includes('nominatim') || url.hostname.includes('msauth')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Update cache with the fresh copy
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});

// Listen for messages from the page (e.g. force update)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
