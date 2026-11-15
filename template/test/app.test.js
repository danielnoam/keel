// The app's own files: `node test/app.test.js`. What index.html loads,
// sw.js keeps for offline, and the three places the version lives agree.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
}

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const index = read("index.html"), sw = read("sw.js"), app = read("src/app.js");
const assets = JSON.parse("[" + /const ASSETS = \[([\s\S]*?)\];/.exec(sw)[1].replace(/,\s*$/, "") + "]");

test("everything index.html loads is kept for offline, and is there", () => {
  const loaded = [...index.matchAll(/(?:src|href)="([^"?#:]+)(?:\?[^"]*)?"/g)].map((m) => "./" + m[1]);
  for (const f of loaded) assert.ok(assets.includes(f), f + " isn't in sw.js's ASSETS");
  for (const f of assets) if (f !== "./") assert.ok(fs.existsSync(path.join(ROOT, f)), f + " is in ASSETS but missing");
});

test("the version is the same in src/app.js and on every ?v= tag", () => {
  const v = /const APP_VERSION = "([^"]+)"/.exec(app)[1];
  const tags = [...index.matchAll(/\?v=([^"]+)"/g)].map((m) => m[1]);
  assert.ok(tags.length > 0);
  assert.deepStrictEqual([...new Set(tags)], [v]);
  assert.ok(/const CACHE = "[^"]*v\d+"/.test(sw));
});

test("every changelog note is filed under a known heading", () => {
  const dir = path.join(ROOT, "changes");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md") && x !== "README.md")) {
    const heads = [...fs.readFileSync(path.join(dir, f), "utf8").matchAll(/^### (.+)$/gm)].map((m) => m[1]);
    assert.ok(heads.length && heads.every((h) => ["Added", "Changed", "Fixed", "Removed"].includes(h)), f);
  }
});

console.log(passed + " passed");
