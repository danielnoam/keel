// WCAG contrast between each theme's colour tokens in src/styles.css,
// through keel's check: `node test/contrast.test.js`. Text needs 4.5:1,
// "ui" (borders, focus rings, icons, large text) 3:1. A new token pair
// the UI puts together goes in PAIRS.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { contrast } = require("../tools/keel-checks.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
}

const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
const THEMES = { light: ":root", dark: ':root[data-theme="dark"]' };
const PAIRS = [
  ["text", "bg"], ["text", "surface"], ["text-dim", "bg"], ["text-dim", "surface"],
  ["accent", "bg", "ui"], ["line", "bg", "ui"], ["line", "surface", "ui"],
];

test("every theme's pairs pass WCAG AA", () => {
  assert.deepStrictEqual(contrast.check(contrast.themes(css, { base: ":root", themes: THEMES }), PAIRS), []);
});

console.log(passed + " passed");
