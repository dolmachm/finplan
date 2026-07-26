/* Finplan offline caching — pages/static only; APIs never cached. */
const STATIC_CACHE = "finplan-static-v2";
const PAGES_CACHE = "finplan-pages-v2";
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE];

const PRECACHE_URLS = ["/dashboard", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => undefined),
        ),
      );
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept authenticated API — always network, no Cache Storage.
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isNavigationOrRsc(request, url)) {
    event.respondWith(networkFirstPage(request));
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(
      url.pathname,
    )
  );
}

function isNavigationOrRsc(request, url) {
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  if (url.searchParams.has("_rsc")) return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match("/dashboard")) ||
      (await caches.match("/dashboard"));
    if (cached) return cached;
    return new Response(
      "<!doctype html><html lang=ru><meta charset=utf-8><title>ФИНКОН</title><body style='font-family:system-ui;padding:2rem'><h1>Нет сети</h1><p>Откройте приложение онлайн хотя бы раз, чтобы сохранить данные для офлайн-просмотра.</p></body></html>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
