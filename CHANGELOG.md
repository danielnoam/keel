# Changelog

## Unreleased

## [0.9.0] - 2026-11-15

### Added
- `src/keel/i18n.js`, on `window.Keel.i18n`: `create({ key, langs,
  fallback, path, version })` gives an app its words in the reader's
  language. The English in `t("...")` is the key and shows until a
  language's table (`src/lang/<code>.js`, `Keel.i18n.strings(code,
  {...})`, loaded only when needed) has it. `{name}` filling with numbers
  in the language's format, `tn(n, one, other)` with the language's
  plural forms (Hebrew's one/two/other), a context for one English word
  with two meanings (`t("Open", { _: "state" })`), `apply(root)` for
  `data-t` and `data-t-attr` markup. `<html>` gets `lang` and `dir`
  (rtl for Hebrew, Arabic and the rest) before the first paint. The
  device's language, or a saved one (`set(code)`, `""` to follow the
  device), `list()` for a picker, and `date`, `time`, `number`,
  `relative`, `join`, `region`, `language`, `compare` through `Intl`.
  `device: false` ignores the device's language, for an app whose table
  is still being written: only a language picked in its settings shows.
  `load: false` leaves loading the table to the app (a script tag before
  its first paint); `t()` reads the table when it's called.
- `tools/keel-checks.js` gets `i18n`: `keys(files)` reads the words the
  code and markup use, `table(file)` a language's table, `check(keys,
  table)` returns what's missing, stale, and broken (a `{name}` the
  English lacks, a plural with no `other`).
- The template loads it, in English and Hebrew: `src/lang/he.js` and
  `test/i18n.test.js`. An app syncing 0.9.0 needs nothing changed until
  it loads `i18n.js`.

- The template's native side, shaped like LifeLog (phone and desktop):
  Capacitor 8 for Android and iOS, Tauri 2 for Windows and Linux, the
  build tools and the workflows (Android release, Desktop, iOS by hand,
  test builds by label, Pages after the tests). `keel-new.js` takes
  `--owner` for the app id. `template-native.yml` builds a new app's APK,
  desktop app and iOS app on every pull request that touches the
  template. Kept in keel only, so no version bump.

## [0.8.0] - 2026-11-15

### Added
- `src/keel/motion.js`, on `window.Keel.motion`: `create({ touch,
  desktop, desktopQuery, reducedMs, cssPrefix })` makes an app's motion
  engine from its own springs (`[stiffness, damping]`, damping may be
  `"critical"`; `desktop: null` for no desktop tier). Waypage's engine,
  moved here: push/pop, grow/shrink, rise/sink/settle, dim, the sidebar
  slides, popFrom/popInto/popOut, dialogIn/Out, edgeIn/Out, morph,
  appear/vanish, measure/flip/ghostOut, page turns, `busy()`,
  `setStill()` for Animations off, and the springs as CSS variables.
  New: `press(selector, { skip })`, LifeLog's press feedback (a dip by
  pixels, back on the control spring). `spring(k, c)` and `edge(s)` are
  exported for one-off curves. Nothing passed gets Waypage's springs.
- The template loads it and makes `__APPNS__.motion` with the defaults.
- `tools/keel-new.js "<Name>" <folder>` and `template/`: a new app's web
  base (strict CSP, service worker with test builds, update check, theme
  tokens, the CSP and contrast tests, the docs, the Tests workflow), with
  keel's files synced in. Kept in keel only, so no version bump.

## [0.7.0] - 2026-11-15

### Added
- `src/keel/platform.js`, on `window.Keel.platform`: where the app runs.
  `native`, `os`, `plugin(name)` for the phone apps (Capacitor),
  `desktop`/`desktopOs` for the desktop app (Tauri), `bundled` for either,
  `ready`/`build` for app-build.json, and links to other sites sent to the
  device's browser (only http(s) and mailto leave), plus `deadline()`.
  Apps load it before their own platform.js and build on it: Waypage's
  and LifeLog's copies of this part were the same code twice.

## [0.6.0] - 2026-11-15

### Added
- `tools/keel-checks.js`, for an app's tests (Node, never shipped):
  `contrast.themes(css, { base, themes })` reads each theme's tokens from
  the app's CSS (a base block, var() and rgba() over the ground handled),
  and `contrast.check(themes, pairs)` names every pair under 4.5:1 (text)
  or 3:1 ("ui"). A token or theme block that isn't there fails too.
  `csp.check(html, files)` names what breaks a strict policy: no meta
  tag, script-src not 'self', unsafe-inline or unsafe-eval, object-src or
  base-uri missing, the tag after a link or script, inline scripts,
  handlers, style attributes or javascript: links, and code that sets
  style or on* attributes or uses eval. Each app keeps its own pairs.

## [0.5.0] - 2026-11-15

### Added
- `src/keel/releases.js`, on `window.Keel.releases`: `create({ name,
  repo, fetchText })` gives `latest()` (the newest app-v release, for the
  update check), `list()` (the test builds, from the pre-releases'
  notes and assets), and in a browser `running`, `webReady`, `open(p)`
  and `back()`. Plus `newer`, `notesOf`, `parse`, `webRepo`. No token is
  sent. The update bar, the Test builds screen and the APK download stay
  in each app.
- `src/keel/sw-preview.js`, on the service worker's `self.KeelPreview`:
  the browser test build's files from its commit, kept for offline, a
  file the commit lacks from the release, and the Back to the release
  bar styled from a served stylesheet (inside the page's CSP). sw.js
  loads it with `importScripts` and calls `respond(e, fromRelease)`.

## [0.4.0] - 2026-11-15

### Added
- `src/keel/errlog.js`, on `window.Keel.errlog`: the errors this device
  hit, from LifeLog's errlog.js and Waypage's log in platform.js. Load it
  before every other script; its tag sets the localStorage key
  (`data-key`), how many to keep (`data-keep`) and whether console.error
  is kept too (`data-console`). Entries carry the time, a kind, the
  message, the first stack lines and the build (from `?v=`); a repeat
  counts up. Addresses lose their query and token-like text is cut, as
  Waypage did. `record`, `note(kind, text)`, `list`, `asText`, `clear`,
  `restore`. Entries from before (an ISO time, no kind) still read.

### Fixed
- `tools/keel-sync.js` no longer prints git's detached-HEAD advice when
  it clones a tag.

## [0.3.0] - 2026-11-15

### Added
- `src/keel/drive.js`, on `window.Keel.drive`: Google Drive backups,
  from Waypage's drive.js with LifeLog's computer sign-in (loopback with
  PKCE and a refresh token). `create({ name, tag, keys, webClient,
  desktopClient, desktopSecret, mime, native, desktop, plugin, tauri,
  openOutside, fileBlob, fresh })` gives `connect`, `disconnect`,
  `getToken`, `list`, `upload` ({ uri } through the Android plugin,
  { blob } or { text } in resumable pieces), `download` (a Blob),
  `remove`, the newest three kept (and one a week old with backups more
  often than weekly), and the settings (`auto`, `every`, `last`, `since`,
  `due`, `get`/`set` for the app's own). What goes in a backup and when
  it runs stay in each app. Apps load it before their own drive code.

## [0.2.0] - 2026-11-15

### Added
- `src/keel/github.js`, on `window.Keel.github`: the GitHub transport
  Waypage's sync.js and LifeLog's storage.js each had. `client(cfg)`
  reads files (`getFile`, `getJson`, `getRaw`; the blob past 1 MB; ETag),
  writes them (`putFile`, `saveFile` with an `onConflict` merge hook,
  `removeFile`), commits many at once (`commitFiles`, remade on a moved
  branch, or a new branch from `root`), and `me`, `repoInfo`,
  `createRepo`, `peekSha`, `listCommits`. Errors carry `kind` (offline,
  auth, ratelimit, server, other), `status` and `detail`; the app words
  them. Apps load it before their sync code.

## [0.1.0] - 2026-11-15

### Added
- `server.js`, from LifeLog's: this computer only, its own folder only,
  400 on a malformed address. The app's name comes from keel.config.json.
  Also serves `.mjs`, `.png` and `.woff2` with their types.
- `src/keel/qr.js`, from LifeLog's `src/qr.js`, on `window.Keel.qr`.
- `tools/release.js`, from LifeLog's, keeping whatever cache prefix the
  app's sw.js has.
- `tools/android-version.js`, as both apps had it.
- `tools/keel-sync.js` and `test/keel.test.js`: pull a release into an
  app, lock it, and fail the app's tests on a local edit.
- `.claude/skills/github-pages`, with keel as its source.
