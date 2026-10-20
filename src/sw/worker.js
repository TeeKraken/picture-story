// Service worker logic. Plain JavaScript with no imports so the build can inline it
// into /sw.js as-is (the `export` keywords are stripped there). Tested in worker.test.ts.

/**
 * The one page this app has. Each version's copy is cached at install, together
 * with the exact files it loads, and never replaced afterwards: the offline copy
 * always matches the cached scripts and styles. A new version gets its own cache,
 * which is used only once that version installed completely.
 */
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
        // cache: "reload" skips the browser's HTTP cache, so the page and files come from this release.
        .then((c) =>
          c.addAll(precache.map((u) => new Request(new URL(u, scope.location.origin).href, { cache: "reload" }))),
        )
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
      event.respondWith(handleNavigation(scope, cacheName, req));
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
 * Network first, so people get updates. The network response is passed through
 * as it is and never cached here: the offline copy stays the one installed with
 * this version's files. With no network, that copy is served.
 */
export async function handleNavigation(scope, cacheName, req) {
  try {
    return await scope.fetch(req);
  } catch {
    const cache = await scope.caches.open(cacheName);
    const hit = await cache.match(SHELL, { ignoreVary: true });
    return hit || Response.error();
  }
}
