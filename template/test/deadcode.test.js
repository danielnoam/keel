// Nothing left behind (RULES.md), through keel's check
// (tools/keel-checks.js): `node test/deadcode.test.js`. A style or a
// function nothing uses any more goes with the change that stopped using
// it, and a helper lives in one file, not re-typed in another.
const fs = require("fs");
const path = require("path");
const { unused } = require("../tools/keel-checks.js");

const root = path.join(__dirname, "..");
const jsIn = (dir) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)) : [])
  .filter((f) => f.endsWith(".js")).map((f) => path.join(root, dir, f));

// The app's own code; keel's files answer to keel.
const OWN = jsIn("src");
const USED = [...OWN, ...jsIn("src/keel"), ...jsIn("tools"), path.join(root, "index.html"), path.join(root, "sw.js")];
// Prefixes of classes made from a value, whose full names are never written out.
const BUILT = ["theme-"];
// Functions run from a list, never called by name.
const SKIP = [];

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message.replace(/\n/g, "\n    ")); }
}

test("every class in styles.css is used", () => {
  const dead = unused.classes(fs.readFileSync(path.join(root, "src", "styles.css"), "utf8"), USED, { built: BUILT });
  if (dead.length) throw new Error("in styles.css and nowhere else; remove the rules:\n" + dead.map((c) => "." + c).join("\n"));
});

test("every function is called from somewhere", () => {
  const dead = unused.functions(OWN, USED, { skip: SKIP });
  if (dead.length) throw new Error("defined and never used; remove them:\n" + dead.map((d) => path.relative(root, d.file) + ":" + d.line + " " + d.name).join("\n"));
});

test("no function is defined in two files", () => {
  const twice = unused.twice(OWN);
  if (twice.length) throw new Error("one helper, one home: export it from one file and use it in the others\n" + twice.map((d) => d.name + ": " + d.files.map((f) => path.relative(root, f)).join(", ")).join("\n"));
});

console.log(passed + " passed");
