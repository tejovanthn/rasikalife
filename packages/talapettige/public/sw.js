/**
 * The service worker. It makes the whole app work offline.
 *
 * Unlike Rasika Classes, nothing here is private: every page is the same for every visitor and
 * every setting lives in the visitor's own `localStorage`. So the worker caches everything the
 * build produced, at install, and the app opens with no network at all after the first visit.
 *
 * `scripts/build-sw.mjs` fills in the file list and the version below after the build. The
 * version is a hash of every cached file, so each deploy installs a fresh cache and drops the
 * old one.
 */
const VERSION = '__VERSION__';
const CACHE = `talapettige-${VERSION}`;
const FONT_CACHE = 'talapettige-fonts';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys.filter(key => key !== CACHE && key !== FONT_CACHE).map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);

  // Pages: network first, so a deploy shows up on the next open; the cached copy when offline.
  // A path the build did not prerender falls back to `/`, which routes on the client.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(url.pathname.replace(/\/$/, '') || '/', { cacheName: CACHE })
          .then(hit => hit || caches.match('/', { cacheName: CACHE }))
      )
    );
    return;
  }

  // Google Fonts: the stylesheet and the font files it names. Not in the precache because the
  // stylesheet's contents depend on the browser asking, so they are kept the first time they load.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(request).then(
          hit =>
            hit ||
            fetch(request).then(response => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
        )
      )
    );
    return;
  }

  // Built assets: cache first. Their names carry a content hash, so a cached copy is never stale.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
  }
});
