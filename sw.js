// Offline support. The app is network-first so updates (and their one-time plan
// repairs) arrive whenever there is signal; the cached copy is the fallback.
// Training data lives in localStorage and is never touched here.
const CACHE = "barlog-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const NETWORK_WAIT_MS = 3000; // weak gym signal: fall back to the cache instead of hanging

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("barlog-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(networkFirst(event, req));
});

async function networkFirst(event, req) {
  const cache = await caches.open(CACHE);
  const key = req.mode === "navigate" ? "./index.html" : req;
  const network = fetch(req.url, { cache: "no-cache" }).then(res => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  const cached = await cache.match(key, { ignoreSearch: true });
  if (!cached) return network; // nothing saved yet: behave like a normal page load
  const timeout = new Promise(resolve => setTimeout(() => resolve(cached), NETWORK_WAIT_MS));
  // Keep refreshing the cache in the background even if the cached copy wins.
  return Promise.race([network.catch(() => cached), timeout]);
}
