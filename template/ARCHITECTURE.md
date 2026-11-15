# __NAME__ architecture

The map of the code. A file added, removed or renamed, or a flow changed,
is updated here in the same change.

## Files

```
index.html           the page: its Content-Security-Policy first, then the scripts in load order
manifest.json        the web app manifest
icon.svg             the app icon
sw.js                the web copy's service worker: offline, test builds (keel's sw-preview.js)
src/app.js           the app; APP_VERSION
src/styles.css       the tokens per theme, then the styles
src/keel/errlog.js   the errors this device hit (from keel, loaded first)
src/keel/platform.js where it runs: browser, phone or desktop (from keel)
src/keel/releases.js the update check and test builds (from keel)
src/keel/motion.js   springs and moves, made in app.js (from keel)
src/keel/sw-preview.js  the service worker's half of a test build (from keel)
test/run-all.js      runs every test/*.test.js
test/app.test.js     index.html, sw.js's ASSETS and the version agree
test/csp.test.js     the policy and the code under it (keel's check)
test/contrast.test.js  every theme's colour pairs pass WCAG AA (keel's check)
test/keel.test.js    keel's files weren't edited here (from keel)
server.js            the local server: this computer only (from keel)
tools/               release.js, keel-sync.js, keel-checks.js, android-version.js (from keel)
tools/build-www.js   copies sw.js's ASSETS into www/ (phones) or www-desktop/ (desktop), with app-build.json
tools/android-manifest.js  what the app adds to Capacitor's AndroidManifest.xml
tools/ios-project.js the iOS project's Info.plist keys and version
tools/sign-apk.sh    signs the APK with the release key, or a throwaway one
tools/test-build.sh  a pull request's build on the test-<branch> pre-release
tools/desktop-files.js  the desktop files under fixed names, and the updater's latest.json
package.json         the native builds' tools only (Capacitor, Tauri)
capacitor.config.json  the phone apps: id, name, colours
src-tauri/           the desktop app: one window on the same files, single instance, updater
assets/logo.svg      the phone apps' icon and splash (@capacitor/assets)
.github/workflows/   tests, Pages, android, ios, desktop, test-builds
```

android/, ios/, www/ and www-desktop/ are made in CI, never committed.

The files listed in `keel.lock.json` come from keel and are never edited
here: fix them in keel, release it, then `node tools/keel-sync.js v<x.y.z>`.

## Trade-offs

What the app gives up on purpose, said plainly. A change that adds one
adds a line here.

## Traps

Things that broke once and would again.
