// keel: tools/keel-new.js and template/ (`node test/template.test.js`).
// A new app is made in a temporary folder, and its own tests must pass.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { create, names } = require("../tools/keel-new.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
}

const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "keel-new-")), "app");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");

test("a name becomes its title, its slug and its global", () => {
  assert.deepStrictEqual(names("Trail Notes"), { __NAME__: "Trail Notes", __SLUG__: "trail-notes", __APPNS__: "TrailNotes" });
  assert.throws(() => names("9lives"), /letter/);
});

test("the new app has the template with its name, and keel's files with a lock", () => {
  create("Trail Notes", dir, { date: "2026-11-15" });
  for (const f of ["index.html", "sw.js", "src/app.js", "CLAUDE.md", "CHANGELOG.md", "keel.lock.json", "src/keel/platform.js", "tools/release.js"]) {
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  }
  const all = [read("index.html"), read("sw.js"), read("src/app.js"), read("CLAUDE.md"), read("CHANGELOG.md")].join("\n");
  assert.ok(!/__[A-Z]+__/.test(all), "a placeholder was left");
  assert.ok(read("sw.js").includes('"TrailNotes".toLowerCase() + "-preview"') && read("src/app.js").includes('name: "TrailNotes"'));
  assert.ok(read("CHANGELOG.md").includes("## [0.1.0] - 2026-11-15"));
  assert.strictEqual(JSON.parse(read("keel.lock.json")).version, JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keel.files.json"), "utf8")).version);
  assert.throws(() => create("Again", dir), /isn't empty/);
});

test("its own tests pass", () => {
  const r = spawnSync(process.execPath, ["test/run-all.js"], { cwd: dir, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test("its first release goes through keel's release.js", () => {
  fs.writeFileSync(path.join(dir, "changes", "feature-x.md"), "### Added\n- A thing.\n");
  const r = spawnSync(process.execPath, ["tools/release.js", "0.2.0"], { cwd: dir, encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(read("src/app.js").includes('const APP_VERSION = "0.2.0"') && read("sw.js").includes('const CACHE = "trail-notes-v2"'));
  const again = spawnSync(process.execPath, ["test/run-all.js"], { cwd: dir, encoding: "utf8" });
  assert.strictEqual(again.status, 0, again.stdout + again.stderr);
});

fs.rmSync(path.dirname(dir), { recursive: true, force: true });
console.log(passed + " passed");
