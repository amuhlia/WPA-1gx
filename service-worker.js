const CACHE_NAME = 'wpa-1gx-v11';
const ASSETS = [
  '.',
  'index.html',
  'style.css',
  'main-v3.js',
  'manifest.webmanifest',
  'images/Alma.jpg',
  'images/Claus.jpg',
  'images/Dante.jpg',
  'images/Ginger.jpg',
  'images/Jazz.jpg',
  'images/Kiara.jpg',
  'images/Luz.jpg',
  'images/Muñeca.jpg',
  'images/Negro.jpg',
  'images/Ruffo.jpg',
  'images/Toby.jpg',
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
