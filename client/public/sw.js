const CACHE_NAME = "roomrent-pwa-v11";
const APP_ROOT = new URL("./", self.registration.scope).href;
const REQUIRED_FILES = [
  APP_ROOT,
  new URL("manifest.webmanifest", APP_ROOT).href,
  new URL("apple-touch-icon.png", APP_ROOT).href,
  new URL("pwa-192.png", APP_ROOT).href,
  new URL("pwa-512.png", APP_ROOT).href,
  new URL("roomrent-mark.svg", APP_ROOT).href,
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const pageResponse = await fetch(APP_ROOT, { cache: "reload" });
  if (!pageResponse.ok) throw new Error("RoomRent app shell could not be cached");
  await cache.put(APP_ROOT, pageResponse.clone());

  const html = await pageResponse.text();
  const referenced = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => match[1])
    .map(path => new URL(path, APP_ROOT))
    .filter(url => url.origin === self.location.origin && url.protocol.startsWith("http"));
  const resources = [...new Set([...REQUIRED_FILES.map(path => new URL(path, APP_ROOT).href), ...referenced])];

  await Promise.all(resources.map(async url => {
    try {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) await cache.put(url, response.clone());
    } catch {
      // A single optional asset must not block the app shell from being installed.
    }
  }));
}

self.addEventListener("install", event => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter(name => name.startsWith("roomrent-pwa-") && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_ROOT, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(request) || await caches.match(APP_ROOT);
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
