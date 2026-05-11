const CACHE_NAME = 'rasika-v1';

const APP_SHELL = ['/manifest.json', '/android-chrome-192x192.png', '/android-chrome-512x512.png'];

// ---------- IndexedDB helpers ----------

function openShareDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('rasika-share', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSharedFiles(files) {
  const db = await openShareDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    store.clear();
    for (const file of files) store.add(file);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Lifecycle ----------

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  // skipWaiting intentionally omitted — controlled via message from client
});

self.addEventListener('activate', event => {
  // Claim immediately so the first share target intercept works without a page reload.
  // On updates, the SwUpdateNotifier shows a toast and the user explicitly reloads.
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---------- Fetch ----------

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Intercept share-target POST: save files to IndexedDB then redirect to a GET so the
  // page can show a spinner and handle auth before re-submitting to the server.
  // Skip if the request already carries ?client=1 (our own client-side re-post).
  if (
    url.pathname === '/events/new/share' &&
    request.method === 'POST' &&
    !url.searchParams.has('client')
  ) {
    event.respondWith(
      (async () => {
        try {
          const formData = await request.formData();
          const files = formData.getAll('files').filter(f => f instanceof File && f.size > 0);
          if (files.length) await saveSharedFiles(files);
        } catch {
          // IDB save failed — component handles empty IDB gracefully
        }
        return Response.redirect('/events/new/share?sw=1', 303);
      })()
    );
    return;
  }

  // Network-first for tRPC API calls
  if (url.pathname.startsWith('/trpc/')) {
    event.respondWith(fetch(request).catch(() => new Response('offline', { status: 503 })));
    return;
  }

  // Network-first for navigation — keeps SSR working correctly
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response('You are offline. Please reconnect and try again.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(caches.match(request).then(cached => cached ?? fetch(request)));
});
