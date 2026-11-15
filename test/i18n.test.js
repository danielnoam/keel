// keel: src/keel/i18n.js and keel-checks.js's i18n check
// (`node test/i18n.test.js`). Each case loads the file fresh into the
// window it describes.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { i18n: check } = require("../tools/keel-checks.js");

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

const FILE = path.join(__dirname, "../src/keel/i18n.js");
const HE = {
  "Save": "שמירה",
  "Saved to {place}": "נשמר ב{place}",
  "{n} pages": { one: "עמוד אחד", two: "שני עמודים", other: "{n} עמודים" },
  "state|Open": "פתוח",
  "Search": "חיפוש",
  "Untranslated": "",
};

function el(attrs = {}, text = "") {
  return {
    attrs: { ...attrs }, textContent: text,
    getAttribute(a) { return a in this.attrs ? this.attrs[a] : null; },
    setAttribute(a, v) { this.attrs[a] = String(v); },
  };
}

function load({ languages = ["en-US"], saved, table = HE, fail = false, langs = ["en", "he"], device } = {}) {
  const items = saved ? { "app.lang": saved } : {};
  const added = [];
  const nodes = { "[data-t]": [], "[data-t-attr]": [] };
  global.window = {
    localStorage: { getItem: (k) => items[k] ?? null, setItem: (k, v) => { items[k] = v; }, removeItem: (k) => { delete items[k]; } },
  };
  Object.defineProperty(globalThis, "navigator", { value: { languages, language: languages[0] }, configurable: true });
  global.document = {
    documentElement: {},
    head: { appendChild: (s) => { added.push(s.src); setImmediate(() => { if (fail) s.onerror(); else { window.Keel.i18n.strings(path.basename(s.src).split(".")[0], table); s.onload(); } }); } },
    createElement: () => ({}),
    querySelectorAll: (sel) => nodes[sel],
  };
  delete require.cache[FILE];
  require(FILE);
  const i18n = window.Keel.i18n.create({ key: "app.lang", langs, version: "1.2.3", device });
  return { i18n, items, added, nodes, root: document.documentElement };
}

(async () => {
  await test("English device: English, ltr, no table loaded, keys read as they are", async () => {
    const { i18n, added, root } = load();
    await i18n.ready;
    assert.deepStrictEqual([i18n.lang, i18n.dir, i18n.choice, root.lang, root.dir, added], ["en", "ltr", "", "en", "ltr", []]);
    assert.strictEqual(i18n.t("Saved to {place}", { place: "Drive" }), "Saved to Drive");
    assert.deepStrictEqual([i18n.tn(1, "{n} page", "{n} pages"), i18n.tn(1200, "{n} page", "{n} pages")], ["1 page", "1,200 pages"]);
    assert.strictEqual(i18n.missing.size, 0);
  });

  await test("a Hebrew device (he-IL, or the old iw) gets Hebrew and rtl before the table is in", async () => {
    for (const code of ["he-IL", "iw"]) {
      const { i18n, root, added } = load({ languages: [code, "en"] });
      assert.deepStrictEqual([i18n.lang, i18n.dir, root.lang, root.dir], ["he", "rtl", "he", "rtl"]);
      assert.strictEqual(i18n.t("Save"), "Save");
      await i18n.ready;
      assert.deepStrictEqual(added, ["src/lang/he.js?v=1.2.3"]);
      assert.strictEqual(i18n.t("Save"), "שמירה");
    }
  });

  await test("a language the app doesn't have falls to English; the device's next choice counts", async () => {
    assert.strictEqual(load({ languages: ["fr-FR"] }).i18n.lang, "en");
    assert.strictEqual(load({ languages: ["fr-FR", "he"] }).i18n.lang, "he");
    assert.strictEqual(load({ languages: ["he"], device: false }).i18n.lang, "en");
    assert.strictEqual(load({ languages: ["en"], saved: "he", device: false }).i18n.lang, "he");
  });

  await test("Hebrew: fills names, numbers in its format, plural forms, context, English where missing", async () => {
    const { i18n } = load({ saved: "he" });
    await i18n.ready;
    assert.strictEqual(i18n.t("Saved to {place}", { place: "דרייב" }), "נשמר בדרייב");
    assert.deepStrictEqual([1, 2, 5].map((n) => i18n.tn(n, "{n} page", "{n} pages")), ["עמוד אחד", "שני עמודים", "5 עמודים"]);
    assert.strictEqual(i18n.t("Open", { _: "state" }), "פתוח");
    assert.strictEqual(i18n.t("Open"), "Open");
    assert.strictEqual(i18n.t("Untranslated"), "Untranslated");
    assert.deepStrictEqual([...i18n.missing].sort(), ["Open", "Untranslated"]);
  });

  await test("a table that won't load leaves the app in English, not stuck", async () => {
    const { i18n } = load({ saved: "he", fail: true });
    assert.strictEqual(await i18n.ready, "he");
    assert.strictEqual(i18n.t("Save"), "Save");
  });

  await test("load: false leaves the table to the app; a table registered later is used", async () => {
    global.window = { localStorage: { getItem: () => "he" } };
    Object.defineProperty(globalThis, "navigator", { value: { languages: ["en"] }, configurable: true });
    const added = [];
    global.document = { documentElement: {}, head: { appendChild: (s) => added.push(s) }, createElement: () => ({}) };
    delete require.cache[FILE];
    require(FILE);
    const i18n = window.Keel.i18n.create({ key: "app.lang", langs: ["en", "he"], load: false });
    assert.strictEqual(await i18n.ready, "he");
    assert.deepStrictEqual([added.length, i18n.t("Save")], [0, "Save"]);
    window.Keel.i18n.strings("he", { Save: "שמירה" });
    assert.strictEqual(i18n.t("Save"), "שמירה");
  });

  await test("the setting: saved, follows the device when cleared, refuses a language the app lacks", async () => {
    const { i18n, items } = load({ languages: ["en"] });
    assert.strictEqual(i18n.set("he"), true);
    assert.strictEqual(items["app.lang"], "he");
    assert.strictEqual(i18n.set("he"), false);
    assert.strictEqual(i18n.set(""), true);
    assert.strictEqual("app.lang" in items, false);
    assert.strictEqual(i18n.set("fr"), false);
    assert.strictEqual(load({ saved: "fr", languages: ["he"] }).i18n.lang, "he");
  });

  await test("apply() translates marked text and attributes, and can run again", async () => {
    const { i18n, nodes } = load({ saved: "he" });
    await i18n.ready;
    const a = el({ "data-t": "" }, " Save "), b = el({ "data-t": "Search" }, "x"), c = el({ "data-t-attr": "placeholder, title", placeholder: "Search", title: "Save" });
    nodes["[data-t]"].push(a, b);
    nodes["[data-t-attr]"].push(c);
    i18n.apply();
    i18n.apply();
    assert.deepStrictEqual([a.textContent, a.attrs["data-t"], b.textContent, c.attrs.placeholder, c.attrs.title], ["שמירה", "Save", "חיפוש", "חיפוש", "שמירה"]);
  });

  await test("the picker list names each language in itself; formatting follows the language", async () => {
    const { i18n } = load({ saved: "he" });
    assert.deepStrictEqual(i18n.list().map((l) => [l.code, l.dir]), [["en", "ltr"], ["he", "rtl"]]);
    assert.strictEqual(i18n.list()[1].name, "עברית");
    assert.strictEqual(i18n.number(1234.5), new Intl.NumberFormat("he").format(1234.5));
    assert.strictEqual(i18n.relative(-1, "day"), new Intl.RelativeTimeFormat("he", { numeric: "auto" }).format(-1, "day"));
    assert.strictEqual(i18n.join(["א", "ב", "ג"]), new Intl.ListFormat("he").format(["א", "ב", "ג"]));
    assert.strictEqual(window.Keel.i18n.dirOf("ar-EG"), "rtl");
  });

  await test("the check finds missing, stale and broken keys across code and markup", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-i18n-"));
    const w = (f, s) => { fs.writeFileSync(path.join(dir, f), s); return path.join(dir, f); };
    const files = [
      w("app.js", [
        'const a = t("Save");',
        "const b = i18n.t('It\\'s {n} o\\'clock', { n });",
        'const c = t("Open", { _: "state" });',
        'const d = i18n.tn(count(x), "{n} page", "{n} pages");',
        '// t("Commented out")',
        'const e = cart("Not a key");',
        'const f = t(`template ${x}`);',
      ].join("\n")),
      w("index.html", '<button data-t>\n  Search\n</button><h1 data-t="Library">Ignored</h1><input data-t-attr="placeholder,title" placeholder="Find" title="Save">'),
    ];
    const used = check.keys(files);
    assert.deepStrictEqual(Object.keys(used).sort(), ["Find", "It's {n} o'clock", "Library", "Save", "Search", "state|Open", "{n} pages"].sort());
    assert.deepStrictEqual(used.Save.map((f) => f.split("/").pop()), ["app.js", "index.html"]);
    const he = w("he.js", 'Keel.i18n.strings("he", ' + JSON.stringify({ ...HE, "Gone": "נעלם", "Library": "{count} ספרים", "Find": { one: "x" } }) + ");");
    const r = check.check(used, check.table(he));
    assert.deepStrictEqual(r.missing, ["It's {n} o'clock"]);
    assert.deepStrictEqual(r.stale, ["Gone", "Saved to {place}", "Untranslated"]);
    assert.deepStrictEqual(r.broken, ["Library: {count} isn't in the English", "Find: a plural needs an `other` form"]);
  });

  console.log(passed + " passed");
})();
