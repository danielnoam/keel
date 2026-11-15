// keel: src/keel/errlog.js (`node test/errlog.test.js`).
const assert = require("assert");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

// A page loading errlog.js from a tag with these attributes.
function load(attrs = {}) {
  const ls = new Map();
  const on = {};
  global.window = {};
  global.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
  global.location = { href: "https://example.com/app/index.html?x=1" };
  global.addEventListener = (k, fn) => { on[k] = fn; };
  global.document = { currentScript: { src: "https://example.com/app/src/keel/errlog.js?v=1.2.3",
    dataset: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k.replace(/^data-/, ""), v])), hasAttribute: (k) => k in attrs } };
  const printed = [];
  global.console = { ...console, error: (...a) => printed.push(a) };
  delete require.cache[require.resolve("../src/keel/errlog.js")];
  require("../src/keel/errlog.js");
  return { E: window.Keel.errlog, on, ls, printed };
}

test("an uncaught error is kept with its build and first stack lines", () => {
  const { E, on, ls } = load({ "data-key": "t.log" });
  const error = new TypeError("x is undefined");
  error.stack = "TypeError: x is undefined\n    at go (https://example.com/app/src/app.js?v=1.2.3:10:5)\n    at https://example.com/app/src/boot.js?v=1.2.3:2:1";
  on.error({ message: "Uncaught TypeError: x is undefined", error });
  const [x] = E.list();
  assert.strictEqual(x.msg, "Uncaught TypeError: x is undefined");
  assert.strictEqual(x.kind, "error");
  assert.strictEqual(x.v, "1.2.3");
  assert.strictEqual(x.where, "at go (src/app.js:10:5)\nat src/boot.js:2:1");
  assert.ok(ls.has("t.log"));
});

test("the same error in a row counts up instead of piling up", () => {
  const { E, on } = load();
  for (let i = 0; i < 3; i++) on.error({ message: "boom" });
  on.error({ message: "other" });
  assert.deepStrictEqual(E.list().map((x) => [x.msg, x.n || 1]), [["boom", 3], ["other", 1]]);
});

test("noise is left out: failed loads, Script error, ResizeObserver, aborts", () => {
  const { E, on } = load();
  on.error({ message: "" });
  on.error({ message: "Script error." });
  on.error({ message: "ResizeObserver loop completed with undelivered notifications." });
  on.unhandledrejection({ reason: Object.assign(new Error("stopped"), { name: "AbortError" }) });
  assert.strictEqual(E.list().length, 0);
  on.unhandledrejection({ reason: new RangeError("too far") });
  assert.strictEqual(E.list()[0].msg, "RangeError: too far");
});

test("tokens and address queries never reach the log", () => {
  const { E } = load();
  E.note("save", "GET https://api.github.com/x?access_token=abc failed with Bearer ghp_secret123 and ya29.tok github_pat_11AB");
  const msg = E.list()[0].msg;
  assert.ok(!/abc|secret123|ya29\.tok|11AB/.test(msg), msg);
  assert.strictEqual(E.list()[0].kind, "save");
});

test("keeps only the newest data-keep", () => {
  const { E } = load({ "data-keep": "5" });
  for (let i = 0; i < 9; i++) E.record("e" + i);
  assert.deepStrictEqual(E.list().map((x) => x.msg), ["e4", "e5", "e6", "e7", "e8"]);
});

test("console.error is kept only with data-console, and still printed", () => {
  let p = load();
  console.error("quiet");
  assert.strictEqual(p.E.list().length, 0);
  p = load({ "data-console": "" });
  console.error("loud", { a: 1 }, new Error("inside"));
  assert.strictEqual(p.printed.length, 1);
  assert.deepStrictEqual([p.E.list()[0].kind, p.E.list()[0].msg], ["console", 'loud {"a":1} inside']);
});

test("as text, cleared, and put back", () => {
  const { E } = load();
  E.record("first");
  E.record("first");
  E.note("save", "second");
  const text = E.asText();
  assert.match(text, /^\d{4}-\d\d-\d\d \d\d:\d\d v1\.2\.3 ×2\nfirst\n\n.* v1\.2\.3 save\nsecond$/);
  const kept = E.list();
  E.clear();
  assert.strictEqual(E.list().length, 0);
  E.restore(kept);
  assert.strictEqual(E.list().length, 2);
});

test("old entries (an ISO time, no kind) still read", () => {
  const { E } = load({ "data-key": "old" });
  localStorage.setItem("old", JSON.stringify([{ at: "2026-11-01T10:00:00.000Z", msg: "from before", v: "0.1" }]));
  assert.match(E.asText(), /^2026-11-01 10:00 v0\.1\nfrom before$/);
  E.record("from before");
  assert.strictEqual(E.list()[0].n, 2);
});

console.log(passed + " passed");
