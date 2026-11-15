// keel: src/keel/qr.js draws a code for a setup link and says when one is
// too long (`node test/qr.test.js`).
const assert = require("assert");
global.window = {};
require("../src/keel/qr.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
}

const qr = window.Keel.qr;
test("hangs on window.Keel.qr", () => assert.strictEqual(typeof qr.svg, "function"));
test("a short link gives an svg of the asked size", () => {
  const svg = qr.svg("https://example.com/#setup=abc", { size: 200 });
  assert.match(svg, /^<svg [^>]*width="200"/);
});
test("version 1 is 21 modules square with its three finder patterns", () => {
  const d = qr._debug("hi");
  assert.strictEqual(d.size, 21);
  for (const [r, c] of [[0, 0], [0, 14], [14, 0]]) assert.strictEqual(d.rows[r].slice(c, c + 7), "1111111");
});
test("too long for version 9 gives null", () => {
  const long = "x".repeat(400);
  assert.strictEqual(qr.fits(long), false);
  assert.strictEqual(qr.svg(long), null);
});
console.log(passed + " passed");
