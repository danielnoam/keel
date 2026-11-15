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
| `src/keel/releases.js` | The app's own releases, on `window.Keel.releases`: the latest one (update check), the test builds list, opening a test build in the browser. Each app keeps its bar and screens |
| `src/keel/sw-preview.js` | The service worker's half of a test build in the browser (`importScripts`): that commit's files, the Back to the release bar |
| `tools/release.js` | `node tools/release.js x.y.z`: bumps APP_VERSION, `?v=` tags and the sw.js cache, folds `changes/*.md` into CHANGELOG.md |
| `tools/android-version.js` | Stamps APP_VERSION into the Android project's versionCode |
| `tools/keel-sync.js` | Pulls a keel release into an app and checks it |
| `tools/keel-checks.js` | Checks for an app's tests: WCAG contrast between theme tokens read from its CSS, and its Content-Security-Policy and the code under it |
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
node tools/keel-new.js "Trail Notes" ../trail-notes
```

writes `template/` into the folder with the app's name in it (title,
`trail-notes` for caches and keys, `TrailNotes` for its global and its
release assets), then brings in keel's shared files as a sync would, lock
and all. What comes out is the web base every kind of app needs:

- `index.html` with a strict Content-Security-Policy, `manifest.json`, `icon.svg`
- `sw.js`: offline for the web copy, and test builds through `sw-preview.js`
- `src/app.js` (APP_VERSION, the theme, the update check) and `src/styles.css` (tokens per theme)
- tests: the CSP and contrast checks, index.html against sw.js's ASSETS and the
  version places, keel's files unedited
- CLAUDE.md, CONTRIBUTING.md, ARCHITECTURE.md, README.md, CHANGELOG.md,
  DROPPED.md, `changes/`, and the Tests workflow

The native side (Capacitor, the Android and iOS workflows, Tauri) isn't in
it yet: it goes in when the first app that needs it is made from the
template. `template/` and `tools/keel-new.js` stay in keel: they are never
synced into an app, and an app made from them is its own from then on.
`test/template.test.js` makes an app and runs its tests and its first
release.

## Changing a shared file

Never in the app: its tests fail. Change it here, add a line to
CHANGELOG.md, bump `version` in keel.files.json and merge: the merge
tags `v<version>` (tag.yml). Then sync each app in its own PR.
