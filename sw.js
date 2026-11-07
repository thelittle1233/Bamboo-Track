/* BambooTrack service worker.
 * Network-first for the app page: online launches get the latest published HTML;
 * cached fallback keeps the last successful version available offline.
 */
const CACHE_NAME = 'bambootrack-app-shell-v1';
const APP_PREFIX = 'bambootrack-';
const APP_BASE = self.registration.scope;
const INDEX_URL = new URL('index.html', APP_BASE).href;
const HOME_URL = APP_BASE;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache both the project home and index file for GitHub Pages project URLs.
    await cache.addAll([HOME_URL, INDEX_URL]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(APP_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(APP_BASE)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
          // Keep a canonical fallback for the app's home page.
          if (url.pathname === new URL(APP_BASE).pathname || url.pathname.endsWith('/index.html')) {
            await cache.put(INDEX_URL, response.clone());
          }
        }
        return response;
      } catch (error) {
        return (await cache.match(request)) || (await cache.match(INDEX_URL)) || (await cache.match(HOME_URL));
      }
    })());
    return;
  }

  // Cache-first for same-origin files, refreshing the cache after a successful fetch.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
