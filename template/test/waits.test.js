// RULES.md: tests wait for the condition, never a fixed sleep for a side
// effect (`node test/waits.test.js`). Long fixed waits (a second or more)
// may only go down: lower MAX when you remove one, never raise it.
const fs = require("fs");
const path = require("path");
const { waits } = require("../tools/keel-checks.js");

const MAX = 0;
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.m?js$/.test(f.name) && p !== __filename) files.push(p);
  }
})(__dirname);
const found = waits.find(files, 1000);
if (found.length > MAX) {
  console.log("  FAIL - " + found.length + " fixed waits of 1s or more in the tests (at most " + MAX + "): wait for the element, request or write instead\n    "
    + found.map((w) => path.relative(path.join(__dirname, ".."), w.file) + ":" + w.line + " (" + w.ms + "ms)").join("\n    "));
  process.exitCode = 1;
} else console.log("  ok - " + found.length + " long fixed waits in the tests (at most " + MAX + ")\n1 passed");
