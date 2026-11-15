# Changelog

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
