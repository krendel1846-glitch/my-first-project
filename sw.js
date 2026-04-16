const CACHE_NAME = 'mixology-pro-v4';
const APP_SHELL = [
  './',
  './?source=pwa&v=4',
  './index.html',
  './manifest.webmanifest?v=4',
  './assets/launch-header.png?v=4',
  './icons/icon-120.png?v=4',
  './icons/icon-152.png?v=4',
  './icons/icon-167.png?v=4',
  './icons/icon-180.png?v=4',
  './icons/icon-192.png?v=4',
  './icons/icon-512.png?v=4',
  './icons/icon-1024.png?v=4'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
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
      const fetchPromise = fetch(req).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
