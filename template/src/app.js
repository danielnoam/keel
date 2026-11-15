// __NAME__: the app. keel's files (src/keel/) load before it: errlog.js
// first, then platform.js (where it runs), releases.js (updates) and
// motion.js (springs and moves).
(function () {
  const APP_VERSION = "0.1.0";
  const K = window.Keel;
  const $ = (id) => document.getElementById(id);

  $("version").textContent = APP_VERSION;

  // The theme follows the system's light or dark.
  const dark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const theme = () => { document.documentElement.dataset.theme = dark && dark.matches ? "dark" : "light"; };
  theme();
  if (dark && dark.addEventListener) dark.addEventListener("change", theme);

  // The web copy works offline through sw.js. A bundled app (phone,
  // desktop) has its files on the device and no service worker.
  if ("serviceWorker" in navigator && location.protocol === "https:" && !K.platform.bundled) {
    navigator.serviceWorker.register("sw.js").catch((e) => K.errlog.note("sw", String(e)));
  }

  // A newer release on GitHub, for the apps; the web copy updates itself.
  // Its name is the one on the release's assets (__APPNS__.apk) and in
  // the test build cache sw.js serves from.
  const releases = K.releases.create({ name: "__APPNS__", repo: () => (K.platform.build && K.platform.build.repo) || null });
  if (K.platform.bundled) {
    K.platform.ready.then(() => releases.latest()).then((r) => {
      if (!r || !K.releases.newer(r.version, APP_VERSION)) return;
      const el = $("update");
      el.textContent = "Version " + r.version + " is out.";
      el.hidden = false;
    }).catch(() => { /* offline: ask again next launch */ });
  }

  // Motion: keel's moves on this app's springs. Pass touch and desktop
  // springs to create() to give the app its own feel; DESIGN.md (once
  // there is one) says which moves it uses.
  const motion = K.motion.create();

  window.__APPNS__ = { version: APP_VERSION, releases, motion };
})();
