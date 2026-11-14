const CACHE_NAME = "roomrent-pwa-v13";
const APP_ROOT = new URL("./", self.registration.scope).href;
const APP_ROOT_URL = new URL(APP_ROOT);
const REQUIRED_FILES = [
  APP_ROOT,
  new URL("manifest.webmanifest", APP_ROOT).href,
  new URL("apple-touch-icon.png", APP_ROOT).href,
  new URL("pwa-192.png", APP_ROOT).href,
  new URL("pwa-512.png", APP_ROOT).href,
  new URL("roomrent-mark.svg", APP_ROOT).href,
];
const REQUIRED_FILE_URLS = new Set(REQUIRED_FILES);
const STATIC_ASSET_TYPES = {
  ".css": ["text/css"],
  ".eot": ["application/vnd.ms-fontobject"],
  ".gif": ["image/gif"],
  ".ico": ["image/x-icon", "image/vnd.microsoft.icon"],
  ".jpeg": ["image/jpeg"],
  ".jpg": ["image/jpeg"],
  ".js": ["javascript", "ecmascript"],
  ".png": ["image/png"],
  ".svg": ["image/svg+xml"],
  ".ttf": ["font/ttf", "application/font-sfnt"],
  ".webmanifest": ["application/manifest+json", "application/json"],
  ".webp": ["image/webp"],
  ".woff": ["font/woff", "application/font-woff"],
  ".woff2": ["font/woff2"],
};

function isAppShellNavigation(url) {
  if (url.origin !== self.location.origin || url.search || url.hash) return false;
  return url.pathname === APP_ROOT_URL.pathname || url.pathname === new URL("index.html", APP_ROOT).pathname;
}

function isCacheableStaticAsset(url) {
  if (url.origin !== self.location.origin || url.search || url.hash) return false;
  if (REQUIRED_FILE_URLS.has(url.href)) return true;

  const assetsRoot = new URL("assets/", APP_ROOT).pathname;
  const extension = url.pathname.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  return url.pathname.startsWith(assetsRoot) && Boolean(extension && STATIC_ASSET_TYPES[extension]);
}

function isPublicResponse(response) {
  if (!response.ok || response.headers.has("set-cookie")) return false;
  const cacheControl = (response.headers.get("cache-control") || "").toLowerCase();
  return !/\b(?:private|no-store)\b/.test(cacheControl);
}

function isPublicHtmlResponse(response) {
  return isPublicResponse(response) && (response.headers.get("content-type") || "").toLowerCase().includes("text/html");
}

function isPublicStaticAssetResponse(url, response) {
  if (!isPublicResponse(response)) return false;
  const extension = url.pathname.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const expectedTypes = extension ? STATIC_ASSET_TYPES[extension] : undefined;
  return Boolean(expectedTypes?.some(type => contentType.includes(type)));
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const pageResponse = await fetch(APP_ROOT, { cache: "reload" });
  if (!isPublicHtmlResponse(pageResponse)) {
    throw new Error("RoomRent app shell could not be cached");
  }
  await cache.put(APP_ROOT, pageResponse.clone());

  const html = await pageResponse.text();
  const referenced = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => match[1])
    .map(path => new URL(path, APP_ROOT))
    .filter(url => url.protocol.startsWith("http") && isCacheableStaticAsset(url))
    .map(url => url.href);
  const resources = [...new Set([
    ...REQUIRED_FILES.filter(path => path !== APP_ROOT),
    ...referenced,
  ])].filter(path => isCacheableStaticAsset(new URL(path)));

  await Promise.all(resources.map(async url => {
    try {
      const resourceUrl = new URL(url);
      const response = await fetch(resourceUrl, { cache: "reload" });
      if (isPublicStaticAssetResponse(resourceUrl, response)) {
        await cache.put(url, response.clone());
      }
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
    if (!isAppShellNavigation(url)) return;
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (isPublicHtmlResponse(response)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(APP_ROOT, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(APP_ROOT);
        return cached || Response.error();
      }
    })());
    return;
  }

  if (!isCacheableStaticAsset(url)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (isPublicStaticAssetResponse(url, response)) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
