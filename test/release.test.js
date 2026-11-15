// keel: tools/release.js bumps the three version places and folds
// changes/*.md into CHANGELOG.md (`node test/release.test.js`).
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { bump, mergeNotes } = require("../tools/release.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { console.error("  FAIL - " + name); console.error("    " + e.message); process.exitCode = 1; }
}

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-release-"));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  return dir;
}

test("release.js bumps the three places and dates the Unreleased entry", () => {
  const dir = fixture({
    "src/app.js": 'const APP_VERSION = "1.2.3";\n',
    "index.html": '<script src="src/app.js?v=1.2.3"></script>\n<link rel="stylesheet" href="src/styles.css?v=1.2.3">\n',
    "sw.js": 'const CACHE = "someapp-v7";\n',
    "CHANGELOG.md": "# Changelog\n\n## Unreleased\n\n### Added\n- A thing.\n\n## [1.2.3] - 2026-01-01\n\n### Fixed\n- Old.\n",
  });
  assert.throws(() => bump("1.2.3", { root: dir }), /isn't above/);
  assert.throws(() => bump("1.3", { root: dir }), /x\.y\.z/);
  const r = bump("1.3.0", { root: dir, date: "2026-02-02" });
  assert.strictEqual(r.tags, 2);
  assert.ok(fs.readFileSync(path.join(dir, "src/app.js"), "utf8").includes('APP_VERSION = "1.3.0"'));
  assert.ok(!fs.readFileSync(path.join(dir, "index.html"), "utf8").includes("1.2.3"));
  assert.ok(fs.readFileSync(path.join(dir, "sw.js"), "utf8").includes("someapp-v8"));
  assert.ok(fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8").startsWith("# Changelog\n\n## [1.3.0] - 2026-02-02\n\n### Added\n- A thing.\n"));
  assert.throws(() => bump("1.4.0", { root: dir }), /nothing to release/);
});

test("release.js writes the entry from changes/ and deletes the notes", () => {
  const dir = fixture({
    "src/app.js": 'const APP_VERSION = "1.2.3";\n',
    "index.html": '<script src="src/app.js?v=1.2.3"></script>\n',
    "sw.js": 'const CACHE = "someapp-v7";\n',
    "CHANGELOG.md": "# Changelog\n\nIntro.\n\n## [1.2.3] - 2026-01-01\n\n### Fixed\n- Old.\n",
    "changes/README.md": "How to write a note.\n",
    "changes/fix-b.md": "### Fixed\n- Bee, over\n  two lines.\n",
    "changes/feature-a.md": "### Added\n- Ay.\n\n### Fixed\n- Ay fix.\n",
  });
  assert.strictEqual(bump("1.3.0", { root: dir, date: "2026-02-02" }).notes, 2);
  assert.strictEqual(fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf8"),
    "# Changelog\n\nIntro.\n\n## [1.3.0] - 2026-02-02\n\n### Added\n- Ay.\n\n### Fixed\n- Ay fix.\n- Bee, over\n  two lines.\n\n## [1.2.3] - 2026-01-01\n\n### Fixed\n- Old.\n");
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, "changes")), ["README.md"]);
  assert.throws(() => mergeNotes(["### Tweaked\n- x\n"]), /unknown heading/);
});

test("release.js keeps any app's cache prefix", () => {
  const dir = fixture({
    "src/app.js": 'const APP_VERSION = "1.0.0";\n',
    "index.html": '<script src="src/app.js?v=1.0.0"></script>\n',
    "sw.js": 'const CACHE = "waypage-v129";\n',
    "CHANGELOG.md": "# Changelog\n\n## Unreleased\n\n### Fixed\n- X.\n",
  });
  assert.strictEqual(bump("1.0.1", { root: dir }).cache, "waypage-v130");
  assert.ok(fs.readFileSync(path.join(dir, "sw.js"), "utf8").includes('"waypage-v130"'));
});

console.log(passed + " passed");
