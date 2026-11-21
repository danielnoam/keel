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
  assert.deepStrictEqual(names("Trail Notes"), { __NAME__: "Trail Notes", __SLUG__: "trail-notes", __APPNS__: "TrailNotes", __OWNER__: "danielnoam", __APPID__: "io.github.danielnoam.trailnotes" });
  assert.strictEqual(names("Trail Notes", "Some-One").__APPID__, "io.github.someone.trailnotes");
  assert.throws(() => names("9lives"), /letter/);
  assert.throws(() => names("Trail", "a/b"), /GitHub user/);
});

test("the new app has the template with its name, and keel's files with a lock", () => {
  create("Trail Notes", dir, { date: "2026-11-15" });
  for (const f of ["index.html", "sw.js", "src/app.js", "CLAUDE.md", "CHANGELOG.md", "keel.lock.json", "src/keel/platform.js", "tools/release.js"]) {
    assert.ok(fs.existsSync(path.join(dir, f)), f);
  }
  const files = [];
  (function walk(rel) {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) walk(r); else files.push(r);
    }
  })("");
  for (const f of files) assert.ok(!/__(NAME|SLUG|APPNS|OWNER|APPID|DATE)__/.test(read(f)), "a placeholder was left in " + f);
  assert.ok(read("sw.js").includes('"TrailNotes".toLowerCase() + "-preview"') && read("src/app.js").includes('name: "TrailNotes"'));
  assert.ok(read("CHANGELOG.md").includes("## [0.1.0] - 2026-11-15"));
  assert.strictEqual(JSON.parse(read("keel.lock.json")).version, JSON.parse(fs.readFileSync(path.join(__dirname, "..", "keel.files.json"), "utf8")).version);
  assert.throws(() => create("Again", dir), /isn't empty/);
});

test("its native side: the phone and desktop configs, and the tools the workflows run", () => {
  const pkg = JSON.parse(read("package.json")), lock = JSON.parse(read("package-lock.json"));
  assert.strictEqual(pkg.name, "trail-notes");
  assert.strictEqual(lock.name, "trail-notes");
  assert.deepStrictEqual(lock.packages[""].devDependencies, pkg.devDependencies, "package-lock.json is out of step with package.json");
  assert.strictEqual(JSON.parse(read("capacitor.config.json")).appId, "io.github.danielnoam.trailnotes");
  const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
  assert.deepStrictEqual([tauri.identifier, tauri.productName], ["io.github.danielnoam.trailnotes", "Trail Notes"]);
  assert.ok(tauri.plugins.updater.endpoints[0].startsWith("https://github.com/danielnoam/trail-notes/releases/latest/"));
  for (const wf of fs.readdirSync(path.join(dir, ".github/workflows"))) {
    const y = read(".github/workflows/" + wf);
    for (const [, t] of y.matchAll(/(?:node|bash) (tools\/[\w.-]+)/g)) assert.ok(fs.existsSync(path.join(dir, t)), wf + " runs " + t + ", which isn't there");
    for (const [, w] of y.matchAll(/uses: \.\/(\.github\/workflows\/[\w.-]+)/g)) assert.ok(fs.existsSync(path.join(dir, w)), wf + " calls " + w);
  }
  assert.ok(/workflow_call:/.test(read(".github/workflows/tests.yml")));
  assert.ok((fs.statSync(path.join(dir, "tools/sign-apk.sh")).mode & 0o111) !== 0, "the shell tools are executable");
});

test("build-www copies the app for the phones and for the desktop", () => {
  const { build } = require(path.join(dir, "tools/build-www.js"));
  const phone = build(path.join(dir, "www"), dir, false), desk = build(path.join(dir, "www-desktop"), dir, true);
  const html = fs.readFileSync(path.join(dir, "www/index.html"), "utf8");
  assert.ok(/<html[^>]*class="native"/.test(html) && /viewport-fit=cover/.test(html));
  assert.ok(/connect-src [^;]*ipc: http:\/\/ipc\.localhost/.test(fs.readFileSync(path.join(dir, "www-desktop/index.html"), "utf8")));
  assert.strictEqual(phone.info.version, "0.1.0");
  assert.ok(desk.info.desktop);
  for (const f of ["index.html", "src/keel/platform.js", "src/keel/motion.js", "app-build.json"]) assert.ok(fs.existsSync(path.join(dir, "www", f)), f);
  fs.rmSync(path.join(dir, "www"), { recursive: true });
  fs.rmSync(path.join(dir, "www-desktop"), { recursive: true });
});

test("a keel-site in index.html is the build's web address", () => {
  const { build, siteMeta } = require(path.join(dir, "tools/build-www.js"));
  const file = path.join(dir, "index.html"), html = fs.readFileSync(file, "utf8");
  try {
    assert.strictEqual(siteMeta(dir), null);
    fs.writeFileSync(file, html.replace("<meta charset=\"utf-8\">", '<meta charset="utf-8">\n  <meta name="keel-site" content="https://example.com/trail">'));
    assert.strictEqual(build(path.join(dir, "www"), dir, false).info.webUrl, "https://example.com/trail/");
  } finally {
    fs.writeFileSync(file, html);
    fs.rmSync(path.join(dir, "www"), { recursive: true, force: true });
  }
});

test("the Android manifest, iOS project and desktop files tools do their part", () => {
  const { patch } = require(path.join(dir, "tools/android-manifest.js"));
  const xml = '<manifest xmlns:android="x">\n  <application android:allowBackup="true" android:label="a">\n  </application>\n</manifest>';
  const out = patch(xml);
  assert.ok(out.includes("REQUEST_INSTALL_PACKAGES") && out.includes('android:allowBackup="false"') && !out.includes('allowBackup="true"'));
  assert.strictEqual(patch(out), out, "patching twice changes nothing");
  const { patchPlist, stampPbxproj } = require(path.join(dir, "tools/ios-project.js"));
  assert.ok(patchPlist('<plist version="1.0">\n<dict>\n</dict>\n</plist>').includes("ITSAppUsesNonExemptEncryption"));
  assert.ok(stampPbxproj("MARKETING_VERSION = 1.0; CURRENT_PROJECT_VERSION = 1;", "0.2.3").includes("CURRENT_PROJECT_VERSION = 2003;"));
  delete process.env.GITHUB_REPOSITORY; // keel's own CI sets it to keel
  const { manifest } = require(path.join(dir, "tools/desktop-files.js"));
  const sigs = fs.mkdtempSync(path.join(os.tmpdir(), "keel-sigs-"));
  fs.writeFileSync(path.join(sigs, "TrailNotes-setup.exe.sig"), "SIG\n");
  const m = manifest("0.1.0", sigs, { date: "x" });
  assert.strictEqual(m.platforms["windows-x86_64"].url, "https://github.com/danielnoam/trail-notes/releases/download/app-v0.1.0/TrailNotes-setup.exe");
  fs.rmSync(sigs, { recursive: true });
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
