const CACHE_NAME = "hookah-mixology-v20-index-rewrite";
const APP_SHELL = [
  './',
  './index.html',
  './app.js?v=20',
  './manifest.webmanifest?v=13',
  './icons/icon-120-v5.png',
  './icons/icon-152-v5.png',
  './icons/icon-167-v5.png',
  './icons/icon-180-v5.png',
  './icons/icon-192-v5.png',
  './icons/icon-512-v5.png',
  './icons/icon-1024-v5.png',
  './assets/banner-v13.png',
  './data/bundled_base.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
