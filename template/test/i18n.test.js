// Every language's table against the words the code and index.html use,
// through keel's check (tools/keel-checks.js): `node test/i18n.test.js`.
// A missing word shows in English; a stale one is dead weight; a broken
// one shows a raw {name}.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { i18n } = require("../tools/keel-checks.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
}

const ROOT = path.join(__dirname, "..");
const src = fs.readdirSync(path.join(ROOT, "src")).filter((f) => f.endsWith(".js")).map((f) => path.join(ROOT, "src", f));
// keel's update.js draws the update bar, so its words are this app's too.
const used = i18n.keys([...src, path.join(ROOT, "src/keel/update.js"), path.join(ROOT, "index.html")]);
const langs = path.join(ROOT, "src/lang");

for (const f of fs.readdirSync(langs).filter((x) => x.endsWith(".js"))) {
  test(f + " has every word, nothing stale, nothing broken", () => {
    const r = i18n.check(used, i18n.table(path.join(langs, f)));
    assert.deepStrictEqual(r, { missing: [], stale: [], broken: [] });
  });
}

console.log(passed + " passed");
