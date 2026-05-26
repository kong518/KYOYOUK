const CACHE_NAME = "cert-assistant-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-512.png"
];

// Install Service Worker
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Fallback for dynamically bundled assets
      });
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch listener - Offline Fallback / Network First strategy
self.addEventListener("fetch", (e) => {
  // Only handle GET requests and skip Chrome extensions or foreign domains if needed
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API or non-static files
  if (e.request.url.includes("/api/")) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Cache successful responses for offline static assets
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Return from cache if offline
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Default offline fallback for routes (return index.html)
          if (e.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/index.html");
          }
        });
      })
  );
});
