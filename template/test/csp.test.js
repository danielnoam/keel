// The page's Content-Security-Policy and the code under it, through keel's
// check (tools/keel-checks.js): `node test/csp.test.js`. A looser policy
// is a decision: write why in ARCHITECTURE.md's Trade-offs, and let this
// test name exactly what was loosened.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { csp } = require("../tools/keel-checks.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
}

const ROOT = path.join(__dirname, "..");
const js = (dir) => fs.existsSync(path.join(ROOT, dir))
  ? fs.readdirSync(path.join(ROOT, dir)).filter((f) => /\.m?js$/.test(f)).map((f) => path.join(ROOT, dir, f)) : [];

test("index.html's policy is strict and the code needs nothing looser", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.deepStrictEqual(csp.check(html, [...js("src"), ...js("src/keel"), ...js("src/vendor")]), []);
});

console.log(passed + " passed");
