const CACHE_NAME = "salah-app-v2";

const FILES = [
  "index.html",
  "style.css",
  "script.js",
  "manifest.json",
  "assets/mosque.png"
];

// Install - cache static files
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - network first for API calls, cache first for static assets
self.addEventListener("fetch", e => {
  let url = new URL(e.request.url);

  // Network-first for API calls
  if (url.hostname !== location.hostname) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request)
      .then(res => res || fetch(e.request))
  );
});
