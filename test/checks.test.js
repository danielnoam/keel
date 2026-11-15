// keel: tools/keel-checks.js (`node test/checks.test.js`).
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { contrast, csp } = require("../tools/keel-checks.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
}

const CSS = `:root {
  --bg: #121212;
  --text: #eeeeee;
  --dim: var(--text);
  --faint: rgba(255, 255, 255, 0.3);
}
html.theme-light {
  --bg: #ffffff;
  --text: #222;
  --faint: #bbbbbb;
}
:root { --gap: 4px; }
[data-theme="paper"] { --bg: #F7F4EE; --text: #F0EDE7; }`;

test("ratios match WCAG's", () => {
  assert.strictEqual(contrast.ratio("#000", "#fff").toFixed(2), "21.00");
  assert.strictEqual(contrast.ratio("#777777", "#ffffff").toFixed(2), "4.48");
  assert.strictEqual(contrast.ratio("rgba(0, 0, 0, 0.5)", "#ffffff").toFixed(2), "3.98");
  assert.strictEqual(contrast.ratio("red", "#fff"), null);
});

test("themes inherit the base and resolve var()", () => {
  const t = contrast.themes(CSS, { base: ":root", themes: { dark: ":root", light: "html.theme-light" } });
  assert.strictEqual(t.dark.gap, "4px", "every :root block counts");
  assert.strictEqual(contrast.resolve(t.light, "dim"), "#222");
  assert.deepStrictEqual(contrast.check(t, [["text", "bg"], ["dim", "bg"]]), []);
});

test("a pair under its bar fails, with the theme, the pair and the ratio", () => {
  const t = contrast.themes(CSS, { base: ":root", themes: { dark: ":root", light: "html.theme-light" } });
  const fails = contrast.check(t, [["faint", "bg", "ui"]]);
  assert.deepStrictEqual(fails, ["dark: --faint on --bg 2.68:1 (needs 3)", "light: --faint on --bg 1.92:1 (needs 3)"]);
  assert.deepStrictEqual(contrast.check({ p: contrast.themes(CSS, { themes: { p: '[data-theme="paper"]' } }).p }, [["text", "bg"]]).length, 1);
});

test("a missing token or theme block fails rather than passing quietly", () => {
  const t = contrast.themes(CSS, { base: ":root", themes: { dark: ":root" } });
  assert.match(contrast.check(t, [["nope", "bg"]])[0], /unreadable/);
  assert.throws(() => contrast.themes(CSS, { themes: { x: "html.theme-x" } }), /no CSS block/);
});

const GOOD = `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'">
<link rel="stylesheet" href="a.css"><script src="a.js"></script></head><body></body></html>`;

test("a strict policy before everything passes", () => {
  assert.deepStrictEqual(csp.check(GOOD), []);
  assert.deepStrictEqual(csp.check("<html></html>"), ["index.html has no Content-Security-Policy meta tag"]);
});

test("what breaks the policy is named", () => {
  const bad = GOOD.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace("object-src 'none'; ", "")
    .replace("<body>", '<body><script>go()</script><a href="javascript:go()" onclick="go()" style="color:red">x</a>');
  const p = csp.check(bad);
  for (const want of ["script-src", "unsafe-inline", "object-src", "inline <script>", "onclick", "style=", "javascript:"]) {
    assert.ok(p.some((x) => x.includes(want)), want + " not named: " + p.join(" | "));
  }
  assert.ok(csp.check('<link rel="icon">' + GOOD).some((x) => /must come before/.test(x)));
});

test("code that needs unsafe-inline or unsafe-eval is named", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-csp-"));
  const ok = path.join(dir, "ok.js"), bad = path.join(dir, "bad.js");
  fs.writeFileSync(ok, "el.style.color = 'red';\n// eval( is fine in a comment\n");
  fs.writeFileSync(bad, "a.setAttribute('style', 'x'); b.setAttribute(\"onclick\", 'y'); new Function('z');");
  const p = csp.check(GOOD, [ok, bad]);
  assert.strictEqual(p.length, 3, p.join(" | "));
  assert.ok(p.every((x) => x.includes("bad.js")));
});

console.log(passed + " passed");
