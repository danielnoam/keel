// keel: src/keel/update.js, with the phone's plugins faked (`node test/update.test.js`).
const assert = require("assert");

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

global.window = {};
const store = new Map();
global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
require("../src/keel/releases.js");
require("../src/keel/update.js");
const U = window.Keel.update;

const t = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
const els = () => ({ bar: { hidden: true }, text: { textContent: "" }, btn: { textContent: "", disabled: false }, close: {} });

function phone({ failDownload, failOpen, files = [] } = {}) {
  const calls = [];
  let progress = null;
  const Filesystem = {
    async addListener(ev, fn) { progress = fn; return { remove() { progress = null; } }; },
    async downloadFile(o) { calls.push(["download", o.url, o.path]); if (progress) progress({ bytes: 50, contentLength: 100 }); if (failDownload) throw new Error("net"); },
    async getUri(o) { return { uri: "file:///cache/" + o.path }; },
    async readdir() { return { files: files.map((name) => ({ name })) }; },
    async deleteFile(o) { calls.push(["delete", o.path]); },
  };
  const FileOpener = { async openFile(o) { calls.push(["open", o.path, o.mimeType]); if (failOpen) throw new Error("no"); } };
  const opened = [];
  const plugins = { Filesystem, FileOpener };
  const platform = { native: true, os: "android", plugin: (n) => plugins[n] || null, build: { repo: "me/App" }, openOutside: (u) => opened.push(u) };
  return { platform, plugins, calls, opened };
}
const make = (p, more) => U.create({ name: "App", platform: p.platform, ...more });

(async () => {
  await test("a release's APK is named by its tag; an unreleased build's is its own url; a test build's is its tag", () => {
    const u = make(phone());
    assert.strictEqual(u.apkUrl({ channel: "release", version: "1.2.3" }), "https://github.com/me/App/releases/download/app-v1.2.3/App.apk");
    assert.strictEqual(u.fileName({ channel: "release", version: "1.2.3" }), "App-1.2.3.apk");
    assert.strictEqual(u.apkUrl({ channel: "unreleased", sha: "0123456789", url: "https://x/unreleased/App.apk" }), "https://x/unreleased/App.apk");
    assert.strictEqual(u.fileName({ channel: "unreleased", sha: "0123456789abcdef" }), "App-unreleased-0123456.apk");
    assert.strictEqual(u.apkUrl({ tag: "test-fix-x", key: "test-fix-x-abcdef1" }), "https://github.com/me/App/releases/download/test-fix-x/App.apk");
    assert.strictEqual(u.fileName({ tag: "test-fix-x", key: "test-fix-x-abcdef1" }), "App-test-fix-x-abcdef1.apk");
  });

  await test("download goes to the cache with progress and resolves to the file; null where it can't install", async () => {
    const p = phone();
    const seen = [];
    const uri = await make(p).download({ channel: "release", version: "1.2.3" }, (f, b, n) => seen.push([f, b, n]));
    assert.strictEqual(uri, "file:///cache/App-1.2.3.apk");
    assert.deepStrictEqual(seen, [[0.5, 50, 100]]);
    p.platform.os = "ios";
    assert.strictEqual(await make(p).download({ version: "1.2.3" }), null);
    const q = phone();
    delete q.plugins.FileOpener;
    assert.strictEqual(await make(q).download({ version: "1.2.3" }), null);
  });

  await test("an app's own fetch is tried first; null from it falls back to Filesystem; its errors pass through", async () => {
    const p = phone();
    const got = await make(p, { fetch: async (url, path, on) => { on(1, 9, 9); return "content://own/" + path; } }).download({ version: "1.2.3" }, () => {});
    assert.strictEqual(got, "content://own/App-1.2.3.apk");
    assert.strictEqual(p.calls.length, 0);
    assert.strictEqual(await make(p, { fetch: async () => null }).download({ version: "1.2.3" }), "file:///cache/App-1.2.3.apk");
    await assert.rejects(make(p, { fetch: async () => { throw Object.assign(new Error("Paused"), { code: "PAUSED" }); } }).download({ version: "1.2.3" }), { code: "PAUSED" });
  });

  await test("Update downloads with progress, then opens Android's installer; Install reopens it without downloading", async () => {
    const p = phone();
    const e = els();
    assert.strictEqual(make(p).offer({ channel: "release", version: "1.2.3" }, e, t), true);
    assert.strictEqual(e.bar.hidden, false);
    assert.strictEqual(e.text.textContent, "Version 1.2.3 is out.");
    assert.strictEqual(e.btn.textContent, "Update");
    await e.btn.onclick();
    assert.deepStrictEqual(p.calls, [
      ["download", "https://github.com/me/App/releases/download/app-v1.2.3/App.apk", "App-1.2.3.apk"],
      ["open", "file:///cache/App-1.2.3.apk", "application/vnd.android.package-archive"],
    ]);
    assert.strictEqual(e.text.textContent, "Version 1.2.3 is ready to install.");
    assert.strictEqual(e.btn.textContent, "Install");
    assert.strictEqual(e.btn.disabled, false);
    await e.btn.onclick();
    assert.strictEqual(p.calls.filter((c) => c[0] === "download").length, 1);
    assert.strictEqual(p.calls.filter((c) => c[0] === "open").length, 2);
  });

  await test("a failed download offers Try again, which downloads again; an installer that won't open says so", async () => {
    const p = phone({ failDownload: true });
    const e = els();
    make(p).offer({ channel: "release", version: "1.2.3" }, e, t);
    await e.btn.onclick();
    assert.strictEqual(e.text.textContent, "The download didn't finish.");
    assert.strictEqual(e.btn.textContent, "Try again");
    await e.btn.onclick();
    assert.strictEqual(p.calls.filter((c) => c[0] === "download").length, 2);
    const q = phone({ failOpen: true });
    const e2 = els();
    make(q).offer({ channel: "release", version: "1.2.3" }, e2, t);
    await e2.btn.onclick();
    assert.strictEqual(e2.text.textContent, "Couldn't open the installer.");
    assert.strictEqual(e2.btn.textContent, "Try again");
  });

  await test("without the plugins the APK opens in the phone's browser; on iOS or a computer, the release page", () => {
    const p = phone();
    delete p.plugins.Filesystem;
    const e = els();
    make(p).offer({ channel: "release", version: "1.2.3" }, e, t);
    assert.strictEqual(e.btn.textContent, "Download");
    e.btn.onclick();
    const d = { native: false, os: "web", desktop: true, build: { repo: "me/App" }, openOutside: (u) => p.opened.push(u) };
    const e2 = els();
    U.create({ name: "App", platform: d }).offer({ channel: "release", version: "1.2.3" }, e2, t);
    assert.strictEqual(e2.btn.textContent, "Get it");
    e2.btn.onclick();
    const e3 = els();
    U.create({ name: "App", platform: d }).offer({ channel: "unreleased", sha: "0123456789", url: "https://x/unreleased/App.zip" }, e3, t);
    e3.btn.onclick();
    assert.deepStrictEqual(p.opened, ["https://github.com/me/App/releases/download/app-v1.2.3/App.apk",
      "https://github.com/me/App/releases/tag/app-v1.2.3", "https://x/unreleased/App.zip"]);
  });

  await test("× hides the bar and keeps it closed for that update, until a newer one", () => {
    store.clear();
    const p = phone();
    const e = els();
    const u = make(p);
    u.offer({ channel: "unreleased", sha: "0123456789", url: "https://x/a.apk" }, e, t);
    assert.strictEqual(e.text.textContent, "A newer unreleased build is ready (0123456).");
    e.close.onclick();
    assert.strictEqual(e.bar.hidden, true);
    assert.strictEqual(store.get("app.update.skip"), "0123456789");
    const again = els();
    assert.strictEqual(u.offer({ channel: "unreleased", sha: "0123456789", url: "https://x/a.apk" }, again, t), false);
    assert.strictEqual(again.bar.hidden, true);
    assert.strictEqual(u.offer({ channel: "release", version: "1.2.4" }, again, t), true);
  });

  await test("at launch: releases at or behind this build and every test or unreleased APK go; a newer release's stays", async () => {
    const p = phone({ files: ["App-1.2.3.apk", "App-1.2.4.apk", "App-1.2.0.apk", "App-unreleased-abc1234.apk", "App-test-fix-x-abcdef1.apk", "Other-1.0.0.apk", "x.json"] });
    await make(p).clearOld({ version: "1.2.3", sha: "fff0000" });
    assert.deepStrictEqual(p.calls.map((c) => c[1]), ["App-1.2.3.apk", "App-1.2.0.apk", "App-unreleased-abc1234.apk", "App-test-fix-x-abcdef1.apk"]);
  });

  await test("keepBuilds: a test or unreleased APK goes only once it's this build; a .part too", async () => {
    const p = phone({ files: ["App-1.2.3.apk.part", "App-unreleased-abc1234.apk", "App-test-fix-x-abcdef1.apk", "App-test-fix-y-1234567.apk.part"] });
    await make(p, { keepBuilds: true }).clearOld({ version: "1.2.3", sha: "abcdef1999" });
    assert.deepStrictEqual(p.calls.map((c) => c[1]), ["App-1.2.3.apk.part", "App-test-fix-x-abcdef1.apk"]);
  });

  await test("a plain version string is enough for clearOld", async () => {
    const p = phone({ files: ["App-1.2.3.apk", "App-1.2.4.apk"] });
    await make(p).clearOld("1.2.3");
    assert.deepStrictEqual(p.calls.map((c) => c[1]), ["App-1.2.3.apk"]);
  });

  console.log(passed + " passed");
})();
