// Service worker logic. Plain JavaScript with no imports so the build can inline it
// into /sw.js as-is (the `export` keywords are stripped there). Tested in worker.test.ts.

/** The one page this app has. Only a good copy of it is ever cached. */
export const SHELL = "/";

/**
 * @param {any} scope  the service worker global (self), or a fake in tests
 * @param {{ cacheName: string, precache: string[] }} config
 */
export function registerWorker(scope, config) {
  const { cacheName, precache } = config;

  scope.addEventListener("install", (event) => {
    event.waitUntil(
      scope.caches
        .open(cacheName)
        .then((c) => c.addAll(precache))
        .then(() => scope.skipWaiting()),
    );
  });

  scope.addEventListener("activate", (event) => {
    event.waitUntil(
      scope.caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k !== cacheName).map((k) => scope.caches.delete(k))))
        .then(() => scope.clients.claim()),
    );
  });

  scope.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET" || new URL(req.url).origin !== scope.location.origin) return;
    if (req.mode === "navigate") {
      event.respondWith(handleNavigation(scope, cacheName, req, (p) => event.waitUntil(p)));
      return;
    }
    // ignoreVary: a module script asks with an Origin header, the precache didn't.
    event.respondWith(
      scope.caches
        .open(cacheName)
        .then((c) => c.match(req, { ignoreVary: true }))
        .then((hit) => hit || scope.fetch(req)),
    );
  });
}

/**
 * Network first, so people get updates. The app shell is refreshed only from a
 * successful response for the shell itself; error pages and other paths never
 * replace it. With no network, the last good shell is served.
 */
export async function handleNavigation(scope, cacheName, req, waitUntil) {
  let res;
  try {
    res = await scope.fetch(req);
  } catch {
    const cache = await scope.caches.open(cacheName);
    const hit = await cache.match(SHELL, { ignoreVary: true });
    return hit || Response.error();
  }
  const path = new URL(req.url).pathname;
  if (res.ok && !res.redirected && (path === SHELL || path === "/index.html")) {
    const copy = res.clone();
    waitUntil(scope.caches.open(cacheName).then((c) => c.put(SHELL, copy)));
  }
  return res;
}
