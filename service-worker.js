const CACHE_NAME = 'wpa-1gx-v8';
const ASSETS = [
  '.',
  'index.html',
  'style.css',
  'main-v3.js',
  'manifest.webmanifest',
  'images/photo_2026-03-15_19-45-32.jpg',
  'images/photo_2026-03-15_19-45-36.jpg',
  'images/photo_2026-03-15_19-45-41.jpg',
  'images/photo_2026-03-15_19-45-46.jpg',
  'images/photo_2026-03-15_19-45-49.jpg',
  'images/photo_2026-03-15_19-45-52.jpg',
  'images/photo_2026-03-15_19-45-55.jpg',
  'images/photo_2026-03-15_19-45-57.jpg',
  'images/photo_2026-03-15_19-46-00.jpg',
  'images/photo_2026-03-15_19-46-03.jpg',
  'images/photo_2026-03-15_19-46-05.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
