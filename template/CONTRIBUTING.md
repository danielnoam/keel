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

**Every platform.** It works on a phone and on a computer, at phone and
desktop width.

**Design.** Colours are tokens in `src/styles.css`, every theme passes
WCAG AA (`test/contrast.test.js`), touch targets are 44 px, and every
animation has a reduced-motion answer.

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
- The web copy is GitHub Pages from `main`: every merge updates it.
