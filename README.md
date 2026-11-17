# keel

The shared layer under Daniel's no-build apps (Waypage, LifeLog, and the
next ones): the files that were being copied between them by hand, kept
in one place.

Each app pulls keel's files in as **plain committed files**, pinned to a
release. Nothing is a submodule or a package, so the web copy still
serves straight from the repo and the native builds need no extra step.

## What's in it

| File | What it does |
| --- | --- |
| `server.js` | Local static server: this computer only, its own folder only |
| `src/keel/qr.js` | QR encoder for a sync setup link, on `window.Keel.qr` |
| `src/keel/github.js` | The GitHub calls a sync makes, on `window.Keel.github`: read a file (blob past 1 MB, ETag), write with a stale-sha merge hook, many files in one commit, errors with a `kind`. Each app keeps its own merge |
| `src/keel/drive.js` | Google Drive backups, on `window.Keel.drive.create(...)`: sign-in (Android plugin, browser window, computer loopback), the app's folder, resumable uploads, keep the newest three, list, restore, delete. Each app makes the backup itself |
| `src/keel/errlog.js` | The errors this device hit, on `window.Keel.errlog`: loaded first, set up by its own tag (`data-key`, `data-keep`, `data-console`), tokens and address queries cut, repeats counted |
| `src/keel/platform.js` | Where the app runs, on `window.Keel.platform`: phone (`native`, `os`, `plugin()`), desktop (Tauri), browser; `app-build.json`; links to other sites go to the device's browser; `deadline()`. Each app's platform.js keeps the rest |
| `src/keel/motion.js` | Springs sampled into CSS `linear()` and the moves made with them, on `window.Keel.motion.create({touch, desktop, ...})`: screens, sheets, menus, dialogs, lists, press feedback; reduced motion and Animations off handled; sideways moves mirror right to left (`rtl()`, `x(n)`). Each app passes its own springs |
| `src/keel/i18n.js` | The reader's language, on `window.Keel.i18n.create({key, langs})`: `t("English")` keyed by the English (shown as is until a table has it), plurals, `{name}` filling, `data-t` markup, `lang` and `dir="rtl"` on `<html>`, the device's language or a saved choice, dates, numbers and lists through `Intl`. Each app keeps its tables in `src/lang/<code>.js` |
| `src/keel/releases.js` | The app's own releases, on `window.Keel.releases`: the latest one (update check), the test builds list, opening a test build in the browser. Each app keeps its bar and screens |
| `src/keel/sw-preview.js` | The service worker's half of a test build in the browser (`importScripts`): that commit's files, the Back to the release bar |
| `tools/release.js` | `node tools/release.js x.y.z`: bumps APP_VERSION, `?v=` tags and the sw.js cache, folds `changes/*.md` into CHANGELOG.md |
| `tools/android-version.js` | Stamps APP_VERSION into the Android project's versionCode |
| `tools/keel-sync.js` | Pulls a keel release into an app and checks it |
| `tools/keel-checks.js` | Checks for an app's tests: WCAG contrast between theme tokens read from its CSS, its Content-Security-Policy and the code under it, each language's table against the words the code uses (missing, stale, broken `{name}`), RULES.md's motion rules in its CSS (curves are tokens, nothing animates font-size, padding or margin), and long fixed waits in its tests |
| `RULES.md` | The rules that stop bugs and drift: motion, components, words, saving, state, timers, tests. The app's own DESIGN.md and CONTRIBUTING.md name its classes and helpers |
| `test/keel.test.js` | Fails an app's tests if a keel file was edited there |
| `.claude/skills/github-pages` | The GitHub Pages skill |

`keel.files.json` is that list, with keel's version.

## Using it in an app

1. Add `keel.config.json` at the app's root:

   ```json
   { "name": "LifeLog" }
   ```

2. Copy `tools/keel-sync.js` in once, then run
   `node tools/keel-sync.js v0.1.0`. It writes the files and
   `keel.lock.json` (the release and a hash per file).
3. Commit. From then on `test/keel.test.js` runs with the app's tests.

To update: `node tools/keel-sync.js v0.2.0`, look at the diff, commit.

An app expects `tools/build-www.js` to export `appVersion()` (used by
`android-version.js`), `APP_VERSION` in `src/app.js`, and
`const CACHE = "<app>-v<n>"` in `sw.js`.

## Starting a new app

```sh
node tools/keel-new.js "Trail Notes" ../trail-notes [--owner danielnoam]
```

writes `template/` into the folder with the app's name in it (title,
`trail-notes` for caches and keys, `TrailNotes` for its global and its
release assets, `io.github.<owner>.trailnotes` for the phone and desktop
app id), then brings in keel's shared files as a sync would, lock and all.
What comes out is an app on the web, Android and iOS (Capacitor), and
Windows and Linux (Tauri), shaped like LifeLog:

- `index.html` with a strict Content-Security-Policy, `manifest.json`, `icon.svg`
- `sw.js`: offline for the web copy, and test builds through `sw-preview.js`
- `src/app.js` (APP_VERSION, the theme, the update check, motion) and `src/styles.css` (tokens per theme)
- tests: the CSP and contrast checks, index.html against sw.js's ASSETS and the
  version places, keel's files unedited
- CLAUDE.md, CONTRIBUTING.md, ARCHITECTURE.md, README.md (with the
  one-time setup: Pages source, the Android key, the desktop updater key,
  the test labels), CHANGELOG.md, DROPPED.md, `changes/`
- the native side: `package.json` and its lock (Capacitor 8, Tauri 2),
  `capacitor.config.json`, `src-tauri/` (one window, single instance,
  updater), `assets/logo.svg`, and the tools the builds run
  (`build-www.js`, `android-manifest.js`, `ios-project.js`, `sign-apk.sh`,
  `test-build.sh`, `desktop-files.js`)
- the workflows: Tests, Pages after the tests, Android (the release),
  Desktop (Windows, Linux by hand), iOS (by hand), and test builds by
  pull request label

`template/` and `tools/keel-new.js` stay in keel: they are never synced
into an app, and an app made from them is its own from then on.
`test/template.test.js` makes an app and runs its tests, its build tools
and its first release; `.github/workflows/template-native.yml` builds that
app's APK, Windows and Linux app and iOS app for real on any pull request
that touches the template.

## Changing a shared file

Never in the app: its tests fail. Change it here, add a line to
CHANGELOG.md, bump `version` in keel.files.json and merge: the merge
tags `v<version>` (tag.yml). Then sync each app in its own PR.
