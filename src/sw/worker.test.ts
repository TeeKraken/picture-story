import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module without type declarations
import { registerWorker } from "./worker.js";

const ORIGIN = "https://story.test";

/** A tiny in-memory stand-in for the service worker global and Cache Storage. */
function fakeScope(fetchImpl: (url: string) => Promise<Response>) {
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, ORIGIN).pathname;
  const listeners: Record<string, (e: unknown) => void> = {};
  const scope = {
    location: { origin: ORIGIN },
    fetch: (r: Request | string) => fetchImpl(key(r)),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    caches: {
      keys: async () => [...stores.keys()],
      delete: async (n: string) => stores.delete(n),
      open: async (n: string) => {
        if (!stores.has(n)) stores.set(n, new Map());
        const m = stores.get(n)!;
        return {
          match: async (r: Request | string) => m.get(key(r))?.clone(),
          put: async (r: Request | string, res: Response) => void m.set(key(r), res),
          addAll: async (urls: string[]) => {
            for (const u of urls) {
              const res = await scope.fetch(u);
              if (!res.ok) throw new TypeError(`bad response for ${u}`);
              m.set(key(u), res);
            }
          },
        };
      },
    },
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
  };
  async function dispatch(type: string, request?: Request) {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners[type]({
      request,
      waitUntil: (p: Promise<unknown>) => pending.push(p),
      respondWith: (p: Promise<Response>) => (response = p),
    });
    const res = await response;
    await Promise.all(pending);
    return res;
  }
  // Node won't construct a Request with mode "navigate", so use a request-like object.
  const navigate = (path: string) =>
    dispatch("fetch", { url: ORIGIN + path, method: "GET", mode: "navigate" } as unknown as Request);
  const cachedShell = async () => (await scope.caches.open("v1")).match("/");
  return { scope, dispatch, navigate, cachedShell };
}

const page = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html" } });

describe("service worker app shell", () => {
  it("keeps the good shell after 404 and 500 navigations, and serves it offline", async () => {
    let mode: "ok" | "404" | "500" | "offline" = "ok";
    const { scope, dispatch, navigate, cachedShell } = fakeScope(async (path) => {
      if (mode === "offline") throw new TypeError("Failed to fetch");
      if (mode === "404" || path === "/review-missing-route") return page("404: NOT_FOUND", 404);
      if (mode === "500") return page("server error", 500);
      return page(path === "/" ? "APP SHELL" : `asset ${path}`);
    });
    registerWorker(scope, { cacheName: "v1", precache: ["/", "/assets/app.js"] });
    await dispatch("install");

    // An unknown route returns 404 to the page, but must not replace the shell.
    const missing = await navigate("/review-missing-route");
    expect(missing!.status).toBe(404);
    expect((await cachedShell())!.status).toBe(200);

    // A server error at the root is passed through, but not cached.
    mode = "500";
    expect((await navigate("/"))!.status).toBe(500);
    expect(await (await cachedShell())!.text()).toBe("APP SHELL");

    mode = "offline";
    const offline = await navigate("/");
    expect(offline!.status).toBe(200);
    expect(await offline!.text()).toBe("APP SHELL");
  });

  it("refreshes the shell from a good online response", async () => {
    let body = "OLD SHELL";
    const { scope, dispatch, navigate, cachedShell } = fakeScope(async () => page(body));
    registerWorker(scope, { cacheName: "v1", precache: ["/"] });
    await dispatch("install");
    body = "NEW SHELL";
    await navigate("/");
    expect(await (await cachedShell())!.text()).toBe("NEW SHELL");
  });

  it("serves precached assets without the network", async () => {
    let online = true;
    const { scope, dispatch } = fakeScope(async (path) => {
      if (!online) throw new TypeError("offline");
      return new Response(`asset ${path}`);
    });
    registerWorker(scope, { cacheName: "v1", precache: ["/", "/assets/app.js"] });
    await dispatch("install");
    online = false;
    const res = await dispatch("fetch", new Request(ORIGIN + "/assets/app.js"));
    expect(await res!.text()).toBe("asset /assets/app.js");
  });
});
