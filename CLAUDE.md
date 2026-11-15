# keel

Shared files for Daniel's no-build apps (Waypage, LifeLog). Read
README.md first.

## Rules

- `git pull --ff-only` first.
- A file goes in keel only if it's byte-identical across apps. Per-app
  differences come from `keel.config.json` or from what the app already
  has (APP_VERSION, sw.js's CACHE), never from app names in keel's code.
- No dependencies, no build step, plain Node and browser JS, as in the
  apps. Browser files hang on `window.Keel`.
- Every change: `node test/run-all.js`, a line in CHANGELOG.md, the
  `version` in keel.files.json bumped (fix: patch, new file or option:
  minor, anything an app must change for: minor before 1.0, and say what
  in CHANGELOG.md). The merge tags `v<version>` by itself
  (`.github/workflows/tag.yml`); a session can't push tags. A change to
  a file outside keel.files.json (CI, docs) needs no bump.
- A file added to or removed from keel is added to or removed from
  keel.files.json and README.md's table in the same change.
- Then sync each app in its own PR on that app's own rules (its
  CLAUDE.md and release checklist): `node tools/keel-sync.js v<version>`.
- `main` takes pull requests. Branch names: fix/<what>, feature/<what>,
  docs/<what>.
