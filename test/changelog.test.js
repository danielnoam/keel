// keel: src/keel/changelog.js (`node test/changelog.test.js`).
const assert = require("assert");

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

global.window = {};
require("../src/keel/changelog.js");
const C = window.Keel.changelog;

const MD = `# Changelog

Intro text, not an entry.

## [Unreleased]

### Added
- A **new** thing, see [the docs](https://x.y/z).

## [1.2.0] - 2026-11-20

### Added
- One
  that goes on.
- Two \`code\`

### Fixed
- Three

## [1.1.0] - 2026-11-10

- No heading

## [1.0.0] - 2026-11-01
`;

(async () => {
  await test("parse reads versions, dates, sections and items", () => {
    const e = C.parse(MD);
    assert.deepStrictEqual(e.map((x) => x.version), ["Unreleased", "1.2.0", "1.1.0", "1.0.0"]);
    assert.strictEqual(e[1].date, "2026-11-20");
    assert.deepStrictEqual(e[1].sections, [{ title: "Added", items: ["One that goes on.", "Two code"] }, { title: "Fixed", items: ["Three"] }]);
    assert.deepStrictEqual(e[2].sections, [{ title: "", items: ["No heading"] }]);
  });

  await test("parse drops Markdown marks", () => {
    assert.strictEqual(C.parse(MD)[0].sections[0].items[0], "A new thing, see the docs.");
  });

  await test("an empty Unreleased is left out", () => {
    const e = C.parse("## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n- x\n");
    assert.deepStrictEqual(e.map((x) => x.version), ["1.0.0"]);
  });

  await test("mine is Unreleased on a build of main, the version otherwise", () => {
    const e = C.parse(MD);
    assert.strictEqual(C.mine(e, "1.2.0").version, "Unreleased");
    assert.strictEqual(C.mine(e.slice(1), "1.2.0").version, "1.2.0");
    assert.strictEqual(C.mine(e.slice(1), "9.9.9"), null);
    assert.strictEqual(C.mine(null, "1.0.0"), null);
  });

  await test("between gives the releases after from, up to to", () => {
    const e = C.parse(MD);
    assert.deepStrictEqual(C.between(e, "1.0.0", "1.2.0").map((x) => x.version), ["1.2.0", "1.1.0"]);
    assert.deepStrictEqual(C.between(e, "1.1.0", "1.1.0"), []);
  });

  await test("newer compares x.y.z", () => {
    assert.ok(C.newer("1.10.0", "1.9.9"));
    assert.ok(!C.newer("1.0.0", "1.0.0"));
  });

  await test("load caches, and tries again after a failure", async () => {
    let calls = 0, fail = true;
    const get = async () => { calls++; if (fail) throw new Error("offline"); return MD; };
    assert.strictEqual(await C.load("a", get), null);
    fail = false;
    assert.strictEqual((await C.load("a", get)).length, 4);
    await C.load("a", get);
    assert.strictEqual(calls, 2);
  });

  console.log(`\n${passed} passed`);
})();
