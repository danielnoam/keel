# Changelog

## Unreleased

## [0.19.0] - 2026-11-26

### Added
- `github.js`: `commitFiles(files, message, { parent })`, the head sha the
  files were worked out from (null: the branch was missing). The commit
  goes on that head or not at all: a branch that moved fails with
  `e.moved`, and the ref update itself enforces it (GitHub refuses one
  that isn't a fast forward). Without it, a `beforeTry` check of the head
  leaves a gap before commitFiles reads the head again: another device's
  commit landing there was overwritten by files made from the older tree.
  Found in Tripboard's sync and CLI, which both had that gap.
- **Apps should**: pass `parent` from any sync that merges against the
  head it read, instead of (or beside) a `beforeTry` head check.

## [0.18.0] - 2026-11-25

### Added
- `tools/keel-checks.js`: `unused.classes(css, used, { built })` (a CSS
  class no file names), `unused.functions(files, used, { skip })` (a
  function never named again) and `unused.twice(files, { only })` (a
  function defined in more than one file). Names only, so a name in a
  comment counts as used: it can miss dead code, but what it reports is
  dead. From LifeLog's 2026-11-25 health pass (eleven dead classes,
  three uncalled functions, the same date helpers re-typed in 17 files).
- `RULES.md`: "Nothing left behind": dead code goes with the change that
  made it dead, and one helper has one home.
- Template: `test/deadcode.test.js` runs all three.
- **Apps should**: run `unused.classes` and `unused.functions` in their
  tests (LifeLog's `test/deadcode.test.js`), and `unused.twice` once
  their copies are gone (or with `only` for the helpers already in one
  place).

## [0.17.0] - 2026-11-24

### Added
- `src/keel/platform.js`: `device` ("android", "ios", "mac", "windows",
  "linux" or "other") and `phone`. In an app it's the app's own os; in a
  browser a best guess from userAgentData, platform and the user agent
  (an iPad that reports a Mac with touch counts as ios). Meant for what
  to offer (which map apps to link to), never for security. Nothing an
  app must change.

## [0.16.0] - 2026-11-22

### Added
- `tools/release.js`: `withPending(root)` is CHANGELOG.md with what's
  merged and not released yet (the notes in `changes/`, and any old
  `## Unreleased` section) on top as `## [Unreleased]`, for a build to
  ship. A build of main (the unreleased channel, a test build) then lists
  in its changelog what it has beyond its version; a release build has
  no notes left, so it ships the file as it is. `pending(root)` is the
  merged entry itself; `bump()` uses it.
- Template: `tools/build-www.js` writes CHANGELOG.md through
  `withPending()` (once the app ships CHANGELOG.md).
- **Apps should**, to show it: write CHANGELOG.md in `tools/build-www.js`
  through `require("./release.js").withPending(root)`, and have their
  changelog screen read `## [Unreleased]` (no date) as not released yet.
## [0.15.0] - 2026-11-21

### Added
- `src/keel/update.js`: installing the app's own update, from LifeLog's,
  Waypage's and Tripboard's own copies, which it replaces. On Android,
  `download(u, onProgress)` puts the release's (or an unreleased or test
  build's) APK in the app's cache through Capacitor's Filesystem, or the
  app's own `fetch` first; `install(uri)` opens Android's installer;
  `clearOld(mine)` drops APKs this build is past at launch (`keepBuilds`
  keeps other test and unreleased ones). `offer(u, els, t)` is the whole
  bar: Update with the %, Install to reopen the installer, Try again,
  and × hiding it until a newer update. Without the plugins and on iOS
  it opens the file or the release page in the browser.
- `update.js` on the desktop app (from LifeLog's): `findDesktop()` asks
  Tauri's updater for the release's latest.json, `installDesktop()`
  downloads, installs and restarts; `offer()` does it from the bar with
  the %, falls back to the release page when the release has no signed
  files (and stays the page), says so when the app's folder is
  read-only, and opens an unreleased build's file. An app with its own
  install (LifeLog's portable exe) passes `desktop: { find, install }`.
- Template: the update bar is a real one on `offer()` (it said "Version
  x is out" with nothing to tap), with `@capacitor/filesystem` and
  `@capawesome-team/capacitor-file-opener` in package.json, the Hebrew,
  and its trade-off in ARCHITECTURE.md. Its i18n test reads update.js's
  words too.
- **Apps must**, to use it: load `src/keel/update.js` after releases.js
  (and add it to sw.js's ASSETS), have both plugins and
  REQUEST_INSTALL_PACKAGES for Android, and have the bar's words in each
  language when they use `offer()`.

## [0.14.0] - 2026-11-21

### Added
- `src/keel/releases.js`: the app's home can be named in index.html, for
  a custom domain or a repo that moved to an organization:
  `<meta name="keel-site" content="https://…/">` (where the unreleased
  builds are looked for) and `<meta name="keel-repo" content="owner/name">`
  (how a web copy away from github.io finds its repo). Without them
  nothing changes: owner.github.io/repo/ as before. `metaSite()` is new.
- `tools/keel-checks.js`: `csp.check` fails a keel-site that isn't https
  or whose origin connect-src doesn't allow, and a keel-repo that isn't
  owner/name.
- Template: `build-www.js` takes app-build.json's `webUrl` from keel-site
  when index.html has one.
- **Apps may**, before a move: add the two metas (and the site's origin
  to connect-src) and make their build-www.js read keel-site the way the
  template's does. Installed copies keep the index.html they were built
  with, so ship a release with the new address before the old one stops
  answering.

## [0.13.1] - 2026-11-20

### Changed
- RULES.md: "Looks that read as machine-made", from Hallmark's list: no
  tracked-capital labels or eyebrows, no middle-dot joins, shadows and
  backdrops as tokens, no card in a card, no decorative status dots, no
  made-up numbers. Rules only; nothing new is checked, so no app has to
  change to sync.

## [0.13.0] - 2026-11-19

### Added
- RULES.md: "Every language, every screen". A feature works in every
  language and on every screen and platform the app ships to, or says
  plainly (PR, release note, docs) which platform it was built for and
  that the others never got it.
- `tools/keel-checks.js`: `i18n.literals(files)` finds UI text set
  straight from an English literal (`toast("...")`, `.textContent =
  "..."`, `setAttribute("alt", "...")` and the like). A line that stays
  English on purpose says `// en-only: <why>`.
- **Apps may**, to enforce it: call `i18n.literals` from their i18n test
  and fail on what it finds.

## [0.12.0] - 2026-11-18

### Added
- The unreleased channel: the newest build of main, which isn't a
  release, offered only inside the app and never on the Releases page.
  Hidden, not private: the repo is public, and anyone with the address
  can download it.
- `src/keel/releases.js`: `channel()` and `setChannel("release" |
  "unreleased")` (kept in localStorage as `<name>.channel`, or
  `channelKey`), `unreleased()` (the site's `unreleased/build.json`),
  `check(mine, kind)` (the update to offer: a newer release, or on
  unreleased a build of main from another commit built after this one),
  `site()` (the Pages site, or the `site` option); `siteOf()` and
  `pick()` on `Keel.releases`.
- `tools/unreleased.js`: `note <android|windows> <file>` in a build of
  main, `fetch <dir>` in the Pages deploy.
- Template: android.yml and desktop.yml build every merge to main and
  leave `unreleased-android` / `unreleased-windows` artifacts; pages.yml
  puts them under `unreleased/` and deploys again when a build of main
  finishes; the update check uses `check()`; the CSP lets the app read
  its own site.
- **Apps must**, to use it: build every merge to main and upload the
  artifact `unreleased-<kind>` (the file and its note) from android.yml
  and desktop.yml; deploy Pages from Actions with `tools/unreleased.js
  fetch unreleased` and the `workflow_run` trigger (template/pages.yml);
  allow their site in connect-src; give Settings a Channel choice and
  read `check()` in the update check.

## [0.11.0] - 2026-11-17

### Added
- `RULES.md`: short rules that stop bugs and drift, each from a real
  bug or inconsistency in LifeLog: motion (exits, direction, curves as
  tokens, no re-layout), components (one class per job, one height per
  bar, swipeable sheets), words (one name per thing, no "— none —"),
  saving (say why, one delete path, refuse bad data on write), state
  (merge over the current record, derived state in one function), timers
  and async, tests (no fixed sleeps).
- `tools/keel-checks.js`: `motion.check(css)` (literal curves, keyword
  curves outside a status loop, transitions or keyframes on font-size,
  line-height, letter-spacing, padding or margin) and `waits.find(files,
  min)` (fixed waits of at least `min` ms in tests).
- Template: `test/motion.test.js` and `test/waits.test.js`; CLAUDE.md and
  CONTRIBUTING.md point to RULES.md.
- **Apps should**: point their CLAUDE.md and CONTRIBUTING.md at RULES.md,
  and run the two checks in their tests.

## [0.10.0] - 2026-11-16

### Changed
- `src/keel/motion.js`: sideways moves follow the page's direction
  (`<html dir>`, read at each move). Right to left, a pushed screen comes
  in from the left and the one under it drifts right; a sidebar slides
  in from the right edge and what's under it drifts left; the next page
  comes in from the left. `from` (where a drag left something) stays in
  screen pixels. `fromPast` and `ghostOut` take `start` and `end` sides.
  New `rtl()` and `x(n)` (n, negated right to left) for an app's own
  drag code.
- **Apps must change**: right to left, the sidebar now animates from the
  right, so its CSS must sit at the inline start (`inset-inline-start: 0`,
  not `left: 0`), and edge swipes and drag directions in the app's own
  code must mirror (`M.x()`). Left to right nothing changes.

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
