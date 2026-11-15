// The service worker for __NAME__'s web copy: installable and usable
// offline. Stale-while-revalidate for the app's own files: a launch paints
// from cache while a fresh copy is fetched for the next one, and the
// ?v=x.y.z on every tag in index.html makes a release's files new URLs.
// Other sites' requests are never touched.
//
// CACHE goes up with every release (tools/release.js). A file added to or
// removed from the app goes in or out of ASSETS (test/app.test.js checks).
const CACHE = "__SLUG__-v1";
const ASSETS = [
  "./", "./index.html", "./manifest.json", "./icon.svg",
  "./src/styles.css", "./src/app.js",
  "./src/keel/errlog.js", "./src/keel/platform.js", "./src/keel/releases.js", "./src/keel/sw-preview.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && !k.startsWith(PREVIEW)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// A test build in the browser: keel's sw-preview.js serves the picked
// commit's files while one is open, with a Back to the release bar.
importScripts("src/keel/sw-preview.js");
// The name keel's releases.js opens a test build into: its `name`, lower case.
const PREVIEW = "__APPNS__".toLowerCase() + "-preview";
const preview = self.KeelPreview.create(PREVIEW);

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(preview.respond(e, fromRelease));
});

function fromRelease(e) {
  return caches.open(CACHE).then((cache) =>
    cache.match(e.request).then((cached) => {
      const fetching = fetch(e.request)
        .then((res) => { if (res && res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => null);
      return cached || fetching.then((res) =>
        res || caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")));
    })
  );
}
