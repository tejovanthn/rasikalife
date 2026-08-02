/**
 * The service worker. Static assets only — never a page, never a write.
 *
 * ## Why this is hand-written rather than generated
 *
 * The plan named `vite-plugin-pwa`. What this app actually needs from a service worker is one
 * rule ("serve the built assets from cache") and one deliberate omission ("do not touch
 * anything else"), and a generated worker with a config file is harder to read than the twenty
 * lines below. The omission is the part worth being able to see at a glance.
 *
 * ## Why no offline writes
 *
 * Queuing a "mark attended" for later sync reads as an obvious win and conflicts directly with
 * the ledger. Every status change is guarded on a conditional transition from `pending`, and a
 * write replayed an hour later can lose that race against the guru or the auto-confirm cron —
 * at which point the student's phone says the class was marked and the ledger says it was
 * settled some other way. There is no correct thing to show them at that point.
 *
 * So: never cache a document or an API response. A page fetched with no network fails, and the
 * app shows an offline state, which is honest. Revisit only if students actually report signal
 * problems in class.
 */
const CACHE = 'rasika-classes-v1';

// Only the things that are identical for every viewer. Anything under /api or any HTML document
// is somebody's private ledger and must never enter a cache the next viewer could read.
const PRECACHE = ['/icons/icon-192.png', '/icons/apple-touch-icon.png', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Same-origin GETs for built assets, and nothing else. `mode: 'navigate'` is what identifies a
  // document request, and those are deliberately left to the network.
  const isAsset =
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    request.mode !== 'navigate' &&
    (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'));

  if (!isAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) {
        return hit;
      }
      return fetch(request).then(response => {
        // Only a clean, complete response is worth keeping; an opaque or partial one cached here
        // would be served forever with no way to tell it was wrong.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
