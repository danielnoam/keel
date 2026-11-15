// keel: src/keel/releases.js and src/keel/sw-preview.js (`node test/releases.test.js`).
const assert = require("assert");

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

// A Cache Storage that lives in memory.
function fakeCaches() {
  const all = new Map();
  const key = (r) => (typeof r === "string" ? r : r.url);
  return {
    all,
    async open(n) {
      if (!all.has(n)) all.set(n, new Map());
      const m = all.get(n);
      return { match: async (r) => { const v = m.get(key(r)); return v ? v.clone() : undefined; }, put: async (r, res) => { m.set(key(r), res); } };
    },
    async keys() { return [...all.keys()]; },
    async delete(n) { return all.delete(n); },
  };
}

global.window = {};
global.location = { hostname: "someone.github.io", pathname: "/app/", href: "https://someone.github.io/app/", replace(u) { this.went = u; } };
global.caches = fakeCaches();
Object.defineProperty(globalThis, "navigator", { value: { serviceWorker: { controller: {} } }, configurable: true });
require("../src/keel/releases.js");
const R = window.Keel.releases;

const RELEASES = [
  { tag_name: "test-fix-x", prerelease: true, name: "Test: Fix x", body: "version: 1.3.0\nbranch: fix/x\ncommit: abcdef1234\npr: 12\n\nmore", published_at: "2026-11-02T00:00:00Z", assets: [{ name: "App.apk" }] },
  { tag_name: "preview-old", prerelease: true, body: "", published_at: "2026-10-01T00:00:00Z", assets: [{ name: "App.ipa" }] },
  { tag_name: "app-v1.2.0", prerelease: false, body: "notes", assets: [] },
  { tag_name: "app-v1.1.0", prerelease: false },
  { tag_name: "test-draft", prerelease: true, draft: true },
];

(async () => {
  await test("versions compare as numbers", () => {
    assert.strictEqual(R.newer("1.10.0", "1.9.9"), true);
    assert.strictEqual(R.newer("1.2.0", "1.2.0"), false);
    assert.strictEqual(R.newer("0.9", "0.10.0"), false);
  });

  await test("a test build's notes, its assets and the newest release", () => {
    const { stable, list } = R.parse(RELEASES, "App");
    assert.strictEqual(stable, "1.2.0");
    assert.deepStrictEqual(list.map((p) => p.tag), ["test-fix-x", "preview-old"]);
    assert.deepStrictEqual([list[0].title, list[0].branch, list[0].version, list[0].sha, list[0].pr, list[0].apk, list[0].ipa],
      ["Fix x", "fix/x", "1.3.0", "abcdef1234", "12", true, false]);
    assert.deepStrictEqual([list[1].branch, list[1].apk, list[1].ipa], ["old", false, true]);
    assert.deepStrictEqual(R.notesOf("version: 1\n\ncommit: x"), { version: "1" });
  });

  await test("the latest release and the list, without a token", async () => {
    const asked = [];
    const fetchText = async (url, opts) => {
      asked.push([url, opts.headers]);
      if (url.endsWith("/releases/latest")) return { status: 200, text: JSON.stringify(RELEASES[2]) };
      return { status: 200, text: JSON.stringify(RELEASES) };
    };
    const c = R.create({ name: "App", repo: () => "me/app", fetchText });
    assert.deepStrictEqual(await c.latest(), { version: "1.2.0", notes: "notes" });
    assert.strictEqual((await c.list()).list.length, 2);
    assert.ok(asked[0][0].startsWith("https://api.github.com/repos/me/app/releases/latest"));
    assert.ok(!("Authorization" in asked[0][1]));
    const odd = R.create({ name: "App", repo: () => "me/app", fetchText: async () => ({ status: 200, text: '{"tag_name":"v2"}' }) });
    assert.strictEqual(await odd.latest(), null);
    const down = R.create({ name: "App", repo: () => "me/app", fetchText: async () => ({ status: 503, text: "" }) });
    await assert.rejects(down.latest());
  });

  await test("a browser opens a test build through the cache, and goes back", async () => {
    const c = R.create({ name: "App" });
    assert.strictEqual(c.repo(), "someone/app");
    assert.strictEqual(c.webReady, true);
    assert.strictEqual(await c.running, null);
    assert.strictEqual(await c.open({ sha: "abc", title: "Fix x", pr: "12", branch: "fix/x", tag: "test-fix-x" }), true);
    assert.strictEqual(location.went, "https://someone.github.io/app/");
    const kept = await (await (await caches.open("app-preview")).match("./preview.json")).json();
    assert.deepStrictEqual([kept.repo, kept.sha], ["someone/app", "abc"]);
    assert.deepStrictEqual(await R.create({ name: "App" }).running.then((p) => p.sha), "abc");
    c.back();
    assert.strictEqual(location.went, "https://someone.github.io/app/?release");
  });

  // ---- the service worker's half ----
  global.self = { registration: { scope: "https://someone.github.io/app/" } };
  require("../src/keel/sw-preview.js");
  const P = self.KeelPreview.create("app-preview");
  const raw = new Map([["index.html", "<html><body>branch</body></html>"], ["src/app.js", "go()"]]);
  let fetched = [];
  global.fetch = async (url) => {
    fetched.push(url);
    const m = /^https:\/\/raw\.githubusercontent\.com\/someone\/app\/abc\/(.+)$/.exec(url);
    if (!m) return new Response("site");
    return raw.has(m[1]) ? new Response(raw.get(m[1])) : new Response("", { status: 404 });
  };
  const ev = (path, mode = "no-cors") => ({ request: { url: "https://someone.github.io/app/" + path, mode } });
  const release = async () => new Response("release");

  await test("a test build's files come from its commit, typed, with the bar on the page", async () => {
    let res = await P.respond(ev("src/app.js"), release);
    assert.strictEqual(await res.text(), "go()");
    assert.strictEqual(res.headers.get("Content-Type"), "text/javascript");
    res = await P.respond(ev("", "navigate"), release);
    const html = await res.text();
    assert.match(html, /<link rel="stylesheet" href="\.\/keel-preview-bar\.css" \/><a class="keel-preview-bar" href="\.\/\?release">Test build: Fix x · Back to the release<\/a><\/body>/);
    assert.strictEqual(await (await P.respond(ev("keel-preview-bar.css"), release)).text().then((t) => t.startsWith(".keel-preview-bar{")), true);
    assert.strictEqual(await (await P.respond(ev("data.json"), release)).text(), "release", "a file the commit lacks comes from the release");
    fetched = [];
    await P.respond(ev("src/app.js"), release);
    assert.deepStrictEqual(fetched, [], "kept for offline");
  });

  await test("a title can't put markup on the page", async () => {
    await (await caches.open("app-preview")).put("./preview.json", new Response(JSON.stringify({ repo: "someone/app", sha: "abc", title: '<img src=x onerror="go()">' })));
    await caches.delete("app-preview-abc");
    const html = await (await P.respond(ev("index.html"), release)).text();
    assert.ok(!html.includes("<img"), html);
  });

  await test("./?release leaves the test build", async () => {
    const res = await P.respond(ev("?release", "navigate"), release);
    assert.strictEqual(res.status, 302);
    assert.deepStrictEqual(await caches.keys(), []);
    assert.strictEqual(await (await P.respond(ev("src/app.js"), release)).text(), "release");
  });

  console.log(passed + " passed");
})();
