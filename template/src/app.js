// __NAME__: the app. keel's files (src/keel/) load before it: errlog.js
// first, then platform.js (where it runs), i18n.js (the reader's
// language), releases.js and update.js (updates) and motion.js (springs and moves).
(function () {
  const APP_VERSION = "0.1.0";
  const K = window.Keel;
  const $ = (id) => document.getElementById(id);

  // Words go through t() in English; src/lang/<code>.js has each other
  // language (test/i18n.test.js checks they match). The language follows
  // the device until the app offers a picker (i18n.list(), i18n.set()).
  // <html> gets lang and dir, so the CSS uses logical sides
  // (margin-inline-start, not margin-left) and works both ways.
  const i18n = K.i18n.create({ key: "__SLUG__.lang", langs: ["en", "he"], version: APP_VERSION });
  const t = i18n.t;
  i18n.ready.then(() => {
    i18n.apply();
    $("version").textContent = t("Version {v}", { v: APP_VERSION });
  });

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
  // the test build cache sw.js serves from. On the channel "unreleased"
  // (releases.setChannel(), kept on this device) the newest build of main
  // is offered too, from the site's unreleased/ (tools/unreleased.js).
  // keel's update.js puts it on the bar: on Android, Update downloads the
  // APK and opens the installer; elsewhere the browser has it. A closed
  // bar stays closed until a newer one.
  const releases = K.releases.create({ name: "__APPNS__", repo: () => (K.platform.build && K.platform.build.repo) || null });
  const updater = K.update.create({ name: "__APPNS__" });
  if (K.platform.bundled) {
    Promise.all([K.platform.ready, i18n.ready]).then(([b]) => {
      updater.clearOld({ version: APP_VERSION, sha: b && b.sha });
      const kind = K.platform.desktopOs === "windows" ? "windows" : K.platform.os === "android" ? "android" : null;
      return releases.check({ version: APP_VERSION, sha: b && b.sha, at: b && b.builtAt }, kind);
    }).then((u) => {
      if (u) updater.offer(u, { bar: $("update"), text: $("updateText"), btn: $("updateBtn"), close: $("updateClose") }, t);
    }).catch(() => { /* offline: ask again next launch */ });
  }

  // Motion: keel's moves on this app's springs. Pass touch and desktop
  // springs to create() to give the app its own feel; DESIGN.md (once
  // there is one) says which moves it uses.
  const motion = K.motion.create();

  window.__APPNS__ = { version: APP_VERSION, i18n, releases, updater, motion };
})();
