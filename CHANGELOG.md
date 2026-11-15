# Changelog

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
