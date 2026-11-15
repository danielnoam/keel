# __NAME__

What __NAME__ is, in a line. Plain HTML, CSS and JS with **no build step
and no dependencies**, started from keel's template.

## Before anything

- `git pull --ff-only` first.
- Read **CONTRIBUTING.md**: the rules for every change, the notes files,
  versions and releases. Below is only what's specific to Claude sessions.

## Shipping

- `main` takes pull requests only. Open the PR, merge it once Tests is
  green, then check the runs.
- Lines for the changelog go in `changes/<branch>.md`, never CHANGELOG.md.
- Shared files come from keel (danielnoam/keel): change them there, then
  sync with `node tools/keel-sync.js v<x.y.z>` in its own PR.

## Branch names

- Don't use the claude/... branch the session was handed. Before the
  first commit, make a branch named for the change: fix/<what>,
  feature/<what> or docs/<what>. Push only to that branch.

## Working with Daniel

- Be direct. Push back when an idea or plan is weak, and say what was
  checked and what is a guess.
- Any security or privacy trade-off: say it plainly and write it in the
  PR description.
