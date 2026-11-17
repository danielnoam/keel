// RULES.md's motion rules in src/styles.css, through keel's check
// (tools/keel-checks.js): `node test/motion.test.js`. Curves are the
// tokens, and nothing animates a property that re-lays out the page.
const fs = require("fs");
const path = require("path");
const { motion } = require("../tools/keel-checks.js");

const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
const bad = motion.check(css);
if (bad.length) {
  console.log("  FAIL - src/styles.css breaks RULES.md's motion rules\n    " + bad.join("\n    "));
  process.exitCode = 1;
} else console.log("  ok - curves are tokens and nothing animates layout\n1 passed");
