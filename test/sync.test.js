// keel: tools/keel-sync.js writes the listed files, locks them, refuses to
// write over a local edit, and removes what keel dropped
// (`node test/sync.test.js`).
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { sync, check } = require("../tools/keel-sync.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
}

function dir(files) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-sync-"));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), text);
  }
  return d;
}
const keel = (version, files) => dir({ ...files, "keel.files.json": JSON.stringify({ version, files: Object.keys(files) }) });
const read = (d, f) => fs.readFileSync(path.join(d, f), "utf8");

test("writes the files and a lock that --check accepts", () => {
  const app = dir({ "src/app.js": "app" });
  const r = sync(keel("0.1.0", { "server.js": "one", "src/keel/qr.js": "qr" }), { root: app });
  assert.strictEqual(r.version, "0.1.0");
  assert.strictEqual(read(app, "src/keel/qr.js"), "qr");
  assert.strictEqual(JSON.parse(read(app, "keel.lock.json")).version, "0.1.0");
  assert.deepStrictEqual(check(app).changed, []);
});

test("a local edit fails --check and stops the next sync", () => {
  const app = dir({});
  sync(keel("0.1.0", { "server.js": "one" }), { root: app });
  fs.writeFileSync(path.join(app, "server.js"), "edited");
  assert.deepStrictEqual(check(app).changed, ["server.js"]);
  assert.throws(() => sync(keel("0.2.0", { "server.js": "two" }), { root: app }), /edited here/);
  assert.strictEqual(read(app, "server.js"), "edited");
  sync(keel("0.2.0", { "server.js": "two" }), { root: app, force: true });
  assert.strictEqual(read(app, "server.js"), "two");
});

test("line endings alone are not an edit", () => {
  const app = dir({});
  sync(keel("0.1.0", { "server.js": "a\nb\n" }), { root: app });
  fs.writeFileSync(path.join(app, "server.js"), "a\r\nb\r\n");
  assert.deepStrictEqual(check(app).changed, []);
});

test("a file keel dropped is removed, the rest stay", () => {
  const app = dir({ "mine.js": "mine" });
  sync(keel("0.1.0", { "server.js": "one", "tools/old.js": "old" }), { root: app });
  const r = sync(keel("0.2.0", { "server.js": "two" }), { root: app });
  assert.deepStrictEqual(r.removed, ["tools/old.js"]);
  assert.ok(!fs.existsSync(path.join(app, "tools/old.js")));
  assert.strictEqual(read(app, "mine.js"), "mine");
});

test("a listed file keel lacks stops the sync", () => {
  const src = keel("0.1.0", { "server.js": "one" });
  fs.unlinkSync(path.join(src, "server.js"));
  assert.throws(() => sync(src, { root: dir({}) }), /doesn't have it/);
});

console.log(passed + " passed");
