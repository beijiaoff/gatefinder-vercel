const CACHE_NAME = "gatefinder-shell-v3";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/data/manifest.json",
  "/data/submerged-radial.json",
  "/data/submerged-slide.json",
  "/data/submerged-wheel.json",
  "/data/surface-radial.json",
  "/data/surface-slide.json",
  "/data/surface-wheel.json",
  "/data/trash-rack.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);

    const homeResponse = await fetch("/");
    const homeHtml = await homeResponse.clone().text();
    await cache.put("/", homeResponse);
    const staticAssets = Array.from(homeHtml.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+)[^\"]*"/g), (match) => match[1]);
    await cache.addAll([...new Set(staticAssets)]);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
