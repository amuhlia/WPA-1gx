const CACHE_NAME = 'wpa-1gx-v12';

// App-shell files: always try network first, fall back to cache.
const NETWORK_FIRST = [
  'index.html',
  'style.css',
  'main-v3.js',
  'manifest.webmanifest',
];

// Static assets: cache-first (images rarely change).
const CACHE_FIRST_ASSETS = [
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

function isNetworkFirst(url) {
  const path = new URL(url).pathname.replace(/^\//, '');
  return (
    path === '' ||
    path === '.' ||
    NETWORK_FIRST.some((f) => path === f || path.endsWith('/' + f))
  );
}

self.addEventListener('install', (event) => {
  // Take control immediately without waiting for old SW to finish.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...NETWORK_FIRST, ...CACHE_FIRST_ASSETS]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Remove old caches.
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      // Take control of all open clients immediately.
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  if (isNetworkFirst(request.url)) {
    // Network-first: always fetch fresh, update cache, fall back to cache.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // Cache-first for images and other static assets.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});
