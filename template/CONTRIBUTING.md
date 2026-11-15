# Contributing to __NAME__

The rules for everyone who works on __NAME__, people and Claude sessions
alike. CLAUDE.md adds only what is specific to Claude.

## Getting started

```sh
node server.js          # http://localhost:5173
node test/run-all.js    # the whole test suite
```

Read ARCHITECTURE.md (the map), DROPPED.md (what was turned down) and
CHANGELOG.md before proposing anything, so nothing shipped or turned down
comes back.

## Decisions that are already made

- **No build step, no dependencies.** Plain files, served as they are.
  Anything vendored goes under `src/vendor/` with its licence beside it.
  `package.json` is only the native builds' tools (Capacitor, Tauri); the
  app never loads anything from it.
- **One set of files everywhere.** The web app, the phone apps and the
  desktop app are the same files: `tools/build-www.js` copies sw.js's
  ASSETS into `www/` (phones) or `www-desktop/` (desktop). What differs
  by platform is decided in keel's platform.js, never sniffed elsewhere.
- **Shared files come from keel.** `src/keel/`, `server.js` and the
  `tools/` keel lists are never edited here (`test/keel.test.js` fails if
  they are).

## Rules for every change

**Security and privacy, as far as it can go.** For every change ask what
it sends, to whom, and what a page, file or other site could do with it.
Least access, nothing leaves the device unless the person turned it on,
and any trade-off is said plainly and written in ARCHITECTURE.md's
Trade-offs. The page's Content-Security-Policy stays strict
(`test/csp.test.js`): no inline script, handler or style attribute.

**Every platform.** It works in a browser, in the phone apps and in the
desktop app, at phone and desktop width. A native plugin or permission is
added in `package.json` and `tools/android-manifest.js` /
`tools/ios-project.js` / `src-tauri/`, with its reason beside it.

**English and Hebrew.** Every word the app shows goes through `t()` (or
`data-t` in index.html) in English, and its Hebrew goes in
`src/lang/he.js` in the same change (`test/i18n.test.js` fails
otherwise). Layout uses logical sides (`margin-inline-start`,
`inset-inline-end`, `text-align: start`), never left and right, so it
mirrors in Hebrew. Text people type or bring in gets `dir="auto"`. Dates
and numbers go through `i18n.date()` and `i18n.number()`.

**Design.** Colours are tokens in `src/styles.css`, every theme passes
WCAG AA (`test/contrast.test.js`), touch targets are 44 px, and every
animation has a reduced-motion answer. Moves go through keel's motion
(`__APPNS__.motion`), which turns each into a short fade under reduced
motion; a CSS transition uses its `--spring-*` variables.

**Ask first for big things.** A new look, a reworked screen or a big
change is shown or explained to Daniel first and waits for his OK.

## Keeping the notes files right

- A change a person can notice adds a note in `changes/` (see its
  README). Only a release writes CHANGELOG.md.
- A "no" becomes an entry in DROPPED.md with the reason.
- ARCHITECTURE.md changes in the same commit as the code it describes.
- Why goes in the commit message and the PR description.

## Versions and releases

- `main` takes pull requests only, merged when the Tests check is green.
- A merge is a release only when it bumps the version:
  `node tools/release.js x.y.z` changes APP_VERSION in `src/app.js`, every
  `?v=` in `index.html` and `CACHE` in `sw.js`, and folds `changes/` into
  CHANGELOG.md. New feature: minor; fix: patch.
- The web copy is GitHub Pages from `main` (`pages.yml`, after the
  tests): every merge updates it.
- A merge with a new version publishes the release `app-v<version>`:
  the APK (`android.yml`), then the Windows app (`desktop.yml`) beside
  it. iOS (`ios.yml`) and Linux build only when run by hand.
- A pull request labelled `test` (or `test-android`, `test-ios`,
  `test-desktop`, `test-linux`) gets a test build on the pre-release
  `test-<branch>`; the label coming off or the PR closing removes it.
