// keel: tools/keel-checks.js (`node test/checks.test.js`).
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { contrast, csp, i18n, motion, waits, unused } = require("../tools/keel-checks.js");

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

test("keel-site must be https and allowed by connect-src; keel-repo owner/name", () => {
  const withMeta = (site, repo, connect = "") => GOOD.replace("object-src", (connect ? "connect-src 'self' " + connect + "; " : "") + "object-src")
    .replace("<link", '<meta name="keel-site" content="' + site + '"><meta name="keel-repo" content="' + repo + '"><link');
  assert.deepStrictEqual(csp.check(withMeta("https://example.com/app/", "someone/app", "https://example.com")), []);
  assert.deepStrictEqual(csp.check(withMeta("https://example.com/app/", "someone/app", "https:")), [], "https: allows it");
  assert.ok(csp.check(withMeta("https://example.com/app/", "someone/app")).some((x) => /connect-src doesn't allow keel-site's https:\/\/example\.com/.test(x)));
  assert.ok(csp.check(withMeta("http://example.com/", "someone/app", "http://example.com")).some((x) => /https address/.test(x)));
  assert.ok(csp.check(withMeta("https://example.com/", "not a repo", "https://example.com")).some((x) => /owner\/name/.test(x)));
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

test("motion: literal and keyword curves fail, tokens, springs and status loops pass", () => {
  const css = `:root { --ease: cubic-bezier(.4,0,.2,1); --spring: linear(0, 1); }
.a { transition: opacity .2s var(--ease), transform var(--spring-ms) var(--spring); }
.b { animation: pulse 1s ease-in-out infinite; }
.c { transition: opacity .1s var(--ease), visibility 0s linear .1s; }
/* .d { transition: color .2s ease; } */
.e { transition: color .2s ease; }
.f { animation: rise .2s cubic-bezier(.2,1,.3,1) both; }`;
  assert.deepStrictEqual(motion.check(css), ["6: the keyword curve `ease`: use a token", "7: a literal curve, cubic-bezier(.2,1,.3,1): use a token"]);
});

test("motion: transitions and keyframes on layout properties fail", () => {
  const css = `.a { transition: color .2s var(--ease), font-size .2s var(--ease); }
.b { transition-property: padding-inline; }
@keyframes grow { from { font-size: 12px; } to { font-size: 14px; } }
@keyframes ok { from { opacity: 0; transform: scale(.9); } }`;
  const out = motion.check(css);
  assert.strictEqual(out.length, 3, out.join("\n"));
  assert.match(out[0], /^1: a transition on font-size/);
  assert.match(out[1], /^2: a transition on padding-inline/);
  assert.match(out[2], /^3: @keyframes grow animates font-size/);
});

test("waits: fixed waits at or over the bar are found with their line", () => {
  const f = path.join(os.tmpdir(), "keel-waits-" + process.pid + ".js");
  fs.writeFileSync(f, "await page.waitForTimeout(300);\nawait page.waitForTimeout(1800);\nawait new Promise((r) => setTimeout(r, 2000));\n");
  try { assert.deepStrictEqual(waits.find([f], 1000).map((w) => [w.line, w.ms]), [[2, 1800], [3, 2000]]); }
  finally { fs.unlinkSync(f); }
});

function tmpFiles(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-unused-"));
  const paths = Object.fromEntries(Object.entries(files).map(([n, text]) => { const p = path.join(dir, n); fs.writeFileSync(p, text); return [n, p]; }));
  try { fn(paths); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("unused.classes: a class no file names is found; built prefixes, comments and urls aren't classes", () => {
  const css = ".row { }\n.row-old, .card:hover { }\n/* .gone */\n.theme-dark .x { background: url(a.svg); width: .5em; }\n";
  tmpFiles({ "a.js": 'el.className = "row card";', "i.html": '<b class="x">' }, (p) => {
    assert.deepStrictEqual(unused.classes(css, [p["a.js"], p["i.html"]], { built: ["theme-"] }), ["row-old"]);
  });
});

test("unused.functions: defined and never named again is found with its line; skip and callers pass", () => {
  tmpFiles({
    "a.js": "function used() {}\nfunction lost() {}\nconst arrow = (x) => x;\nconst listed = async () => 1;\nconst value = 3;\n",
    "b.js": "used(); // arrow\n",
  }, (p) => {
    const out = unused.functions([p["a.js"]], [p["a.js"], p["b.js"]], { skip: ["listed"] });
    assert.deepStrictEqual(out.map((d) => [d.line, d.name]), [[2, "lost"]]);
  });
});

test("unused.twice: a function defined in two files is found, only limits it", () => {
  tmpFiles({
    "a.js": "const pad = (n) => String(n).padStart(2, \"0\");\nfunction init() {}\n",
    "b.js": "  const pad = (n) => (n < 10 ? \"0\" + n : \"\" + n);\n  function init() {}\n",
    "c.js": "pad(1);\n",
  }, (p) => {
    const files = [p["a.js"], p["b.js"], p["c.js"]];
    assert.deepStrictEqual(unused.twice(files).map((d) => [d.name, d.files.length]), [["pad", 2], ["init", 2]]);
    assert.deepStrictEqual(unused.twice(files, { only: ["pad"] }).map((d) => d.name), ["pad"]);
  });
});

test("i18n.literals: English set straight into the UI is found, t() and en-only lines pass", () => {
  const f = path.join(os.tmpdir(), "keel-literals-" + process.pid + ".js");
  fs.writeFileSync(f, [
    'toast("Saved");',
    'toast(t("Saved"));',
    'el.textContent = "Read the original";',
    'el.textContent = n + " left";',
    'img.setAttribute("alt", "Page " + n);',
    'btn.title = "v" + APP_VERSION; // en-only: the version',
    '// toast("in a comment");',
    'if (!ok) return confirm(\'Delete it?\');',
    'el.placeholder = `Search`;',
  ].join("\n"));
  try {
    assert.deepStrictEqual(i18n.literals([f]).map((x) => [x.line, x.text]),
      [[1, "Saved"], [3, "Read the original"], [5, "Page "], [8, "Delete it?"], [9, "Search"]]);
  } finally { fs.unlinkSync(f); }
});

console.log(passed + " passed");
