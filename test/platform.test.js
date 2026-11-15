// keel: src/keel/platform.js (`node test/platform.test.js`). Each case
// loads the file fresh into the window it describes.
const assert = require("assert");
const path = require("path");

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

const FILE = path.join(__dirname, "../src/keel/platform.js");
function load({ cap, tauri, ua = "Mozilla/5.0 (X11; Linux)", build = { repo: "me/app" } } = {}) {
  const opened = [], listeners = [], classes = new Set(), asked = [];
  global.location = { href: "https://localhost/index.html", origin: "https://localhost" };
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: ua }, configurable: true });
  global.document = { documentElement: { classList: { add: (c) => classes.add(c) } }, addEventListener: (t, f) => listeners.push(f) };
  global.fetch = async (u) => { asked.push(u); return { ok: true, json: async () => build }; };
  global.window = { Capacitor: cap, __TAURI__: tauri, open: (u, t) => { opened.push([u, t]); return {}; } };
  delete require.cache[FILE];
  require(FILE);
  return { K: window.Keel.platform, opened, listeners, classes, asked };
}
const phone = (os, plugins = {}) => ({ isNativePlatform: () => true, getPlatform: () => os, Plugins: plugins });

(async () => {
  await test("a browser: web, nothing bundled, no app-build.json, links left alone", async () => {
    const { K, listeners, classes, asked } = load();
    assert.deepStrictEqual([K.native, K.os, K.desktop, K.bundled, K.plugin("Filesystem")], [false, "web", false, false, null]);
    assert.strictEqual(await K.ready, null);
    assert.deepStrictEqual([asked, listeners.length, classes.size], [[], 0, 0]);
    window.open("https://example.org/");
  });

  await test("a phone: its os, its plugins, app-build.json, the native class", async () => {
    const { K, classes, asked } = load({ cap: phone("ios", { Share: { s: 1 } }) });
    assert.deepStrictEqual([K.native, K.os, K.bundled, K.plugin("Share").s, K.plugin("Nope")], [true, "ios", true, 1, null]);
    assert.deepStrictEqual(await K.ready, { repo: "me/app" });
    assert.deepStrictEqual([K.build.repo, asked, [...classes]], ["me/app", ["app-build.json"], ["native"]]);
  });

  await test("a phone sends other sites to its browser, keeps its own, and never javascript:", async () => {
    const urls = [];
    const { K, opened, listeners } = load({ cap: phone("android", { AppLauncher: { openUrl: async (o) => { urls.push(o.url); return { completed: true }; } } }) });
    assert.strictEqual(window.open("https://example.org/a"), null);
    window.open("./settings.html", "_self");
    let stopped = false;
    listeners[0]({ target: { closest: () => ({ href: "https://example.org/b", hasAttribute: () => false }) }, preventDefault: () => { stopped = true; } });
    await new Promise((r) => setImmediate(r));
    assert.deepStrictEqual([urls, opened, stopped], [["https://example.org/a", "https://example.org/b"], [["./settings.html", "_self"]], true]);
    assert.strictEqual(K.openOutside("javascript:alert(1)"), false);
    assert.strictEqual(K.isOutside("https://localhost/x"), false);
  });

  await test("nothing on the phone to open it with: the WebView's own hand-off", async () => {
    const { K, opened } = load({ cap: phone("android", { AppLauncher: { openUrl: async () => ({ completed: false }) } }) });
    K.openOutside("mailto:a@b.c");
    await new Promise((r) => setImmediate(r));
    assert.deepStrictEqual(opened, [["mailto:a@b.c", "_blank"]]);
  });

  await test("the desktop app: bundled but not native, its OS, links through Tauri's opener", async () => {
    const urls = [];
    const { K } = load({ tauri: { core: {}, opener: { openUrl: async (u) => urls.push(u) } }, ua: "Mozilla/5.0 (Windows NT 10.0)" });
    assert.deepStrictEqual([K.native, K.desktop, K.desktopOs, K.bundled, K.os], [false, true, "windows", true, "web"]);
    assert.deepStrictEqual(await K.ready, { repo: "me/app" });
    window.open("https://example.org/");
    assert.deepStrictEqual(urls, ["https://example.org/"]);
  });

  await test("a deadline rejects late work and lets prompt work through", async () => {
    const { K } = load();
    assert.strictEqual(await K.deadline(Promise.resolve(1), 50), 1);
    await assert.rejects(K.deadline(new Promise(() => {}), 10), /Timed out/);
  });

  console.log(passed + " passed");
})();
