// keel: src/keel/drive.js against a small fake of Google Drive
// (`node test/drive.test.js`). The browser's sign-in window is left to
// each app's own browser test; here are the parts every platform shares.
const assert = require("assert");
global.window = { close() {} };
global.btoa = (s) => Buffer.from(s, "binary").toString("base64");
global.BroadcastChannel = undefined; // Node has one, and a listening channel keeps the process open.
require("../src/keel/drive.js");
const D = window.Keel.drive;
const DAY = D.DAY;

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

// A browser-ish world: localStorage, an address, and a Drive behind fetch
// and XMLHttpRequest.
function world({ hash = "", store = {} } = {}) {
  const ls = new Map(Object.entries(store));
  global.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
  global.location = { hash, pathname: "/app/", search: "", origin: "https://example.com", protocol: "https:", hostname: "example.com" };
  global.history = { state: null, replaceState(s, t, url) { location.hash = ""; this.url = url; } };
  global.addEventListener = () => {};
  const g = { files: new Map(), n: 0, calls: [], token: "tok", sessions: new Map(), revoked: [], refresh: "r1" };
  const res = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300, status,
    headers: { get: (k) => headers[k] || null },
    json: async () => (body == null ? Promise.reject(new Error("none")) : body),
    blob: async () => new Blob([body]),
  });
  const row = (f) => ({ id: f.id, name: f.name, size: String(f.bytes ? f.bytes.length : 0), createdTime: new Date(f.at).toISOString(), appProperties: f.appProperties });
  global.fetch = async (url, opts = {}) => {
    const u = new URL(url); const m = opts.method || "GET";
    g.calls.push(m + " " + u.pathname);
    if (u.host === "oauth2.googleapis.com") {
      const q = new URLSearchParams(opts.body);
      if (u.pathname === "/revoke") { g.revoked.push(q.get("token")); return res(200, {}); }
      if (q.get("refresh_token") !== g.refresh) return res(400, { error: "invalid_grant" });
      return res(200, { access_token: g.token, expires_in: 3599 });
    }
    if (opts.headers.Authorization !== "Bearer " + g.token) return res(401, { error: { code: 401 } });
    const p = u.pathname;
    if (p === "/drive/v3/about") return res(200, { user: { emailAddress: "me@example.com" } });
    if (p === "/upload/drive/v3/files" && u.searchParams.get("uploadType") === "resumable") {
      const id = "up" + ++g.n;
      g.sessions.set(id, { meta: JSON.parse(opts.body), total: Number(opts.headers["X-Upload-Content-Length"]), chunks: [] });
      return res(200, {}, { Location: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=" + id });
    }
    if (p === "/drive/v3/files" && m === "POST") {
      const f = { id: "d" + ++g.n, at: Date.now(), ...JSON.parse(opts.body) };
      g.files.set(f.id, f);
      return res(200, { id: f.id });
    }
    if (p === "/drive/v3/files") {
      const q = u.searchParams.get("q");
      let list = [...g.files.values()];
      const name = /name='([^']*)'/.exec(q);
      if (name) list = list.filter((f) => f.name === name[1] && f.mimeType === "application/vnd.google-apps.folder");
      const tag = /key='([^']*)' and value='backup'/.exec(q);
      if (tag) list = list.filter((f) => f.appProperties && f.appProperties[tag[1]] === "backup");
      return res(200, { files: list.map(row) });
    }
    const one = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
    const f = one && g.files.get(decodeURIComponent(one[1]));
    if (!f) return res(404, { error: { code: 404 } });
    if (m === "DELETE") { g.files.delete(f.id); return res(204, null); }
    if (u.searchParams.get("alt") === "media") return res(200, f.bytes);
    return res(200, { id: f.id, trashed: false });
  };
  global.XMLHttpRequest = class {
    constructor() { this.upload = {}; this.h = {}; }
    open(method, url) { this.method = method; this.url = new URL(url); }
    setRequestHeader(k, v) { this.h[k] = v; }
    getResponseHeader(k) { return (this.rh || {})[k] || null; }
    abort() { this.onabort(); }
    async send(body) {
      const s = g.sessions.get(this.url.searchParams.get("upload_id"));
      if (this.h.Authorization !== "Bearer " + g.token) { this.status = 401; this.responseText = "{}"; return this.onload(); }
      const r = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(this.h["Content-Range"]);
      const bytes = Buffer.from(await body.arrayBuffer());
      if (this.upload.onprogress) this.upload.onprogress({ loaded: bytes.length, total: bytes.length });
      s.chunks.push(bytes);
      if (Number(r[2]) + 1 < s.total) { this.status = 308; this.rh = { Range: "bytes=0-" + r[2] }; return this.onload(); }
      const f = { id: "f" + ++g.n, at: Date.now() + g.n * 1000, bytes: Buffer.concat(s.chunks), ...s.meta };
      g.files.set(f.id, f);
      this.status = 200;
      this.responseText = JSON.stringify({ id: f.id, size: String(f.bytes.length) });
      this.onload();
    }
  };
  return g;
}
const KEYS = { cfg: "t.drive", token: "t.token", hand: "t.hand", ask: "t.ask" };
// Android: the plugin hands out tokens.
function phone(g, extra = {}) {
  const plugin = { cleared: [], authorize: async () => ({ token: g.token }), clearToken: async ({ token }) => { plugin.cleared.push(token); } };
  const drive = D.create({ name: "Test", tag: "tdrive", keys: KEYS, mime: "application/json", native: () => true, plugin: () => plugin, ...extra });
  return { drive, plugin };
}

(async () => {
  await test("keeps the newest three, and one a week old with daily backups", () => {
    const now = 100 * DAY;
    const all = [0, 1, 2, 3, 8, 9].map((d, i) => ({ i, at: now - d * DAY }));
    assert.deepStrictEqual([...D.toKeep(all, 1)].map((f) => f.i), [0, 1, 2, 4]);
    assert.deepStrictEqual([...D.toKeep(all, 7)].map((f) => f.i), [0, 1, 2]);
    assert.strictEqual(D.toKeep([], 1).size, 0);
  });
  await test("a backup is due `every` days after the last, or after connecting", () => {
    assert.strictEqual(D.isDue(null, 0), false);
    assert.strictEqual(D.isDue({ auto: false, every: 1, since: 0 }, 5 * DAY), false);
    assert.strictEqual(D.isDue({ auto: true, every: 3, since: 0, last: { at: DAY } }, 3 * DAY), false);
    assert.strictEqual(D.isDue({ auto: true, every: 3, since: 0, last: { at: DAY } }, 4 * DAY), true);
    assert.strictEqual(D.isDue({ auto: true, every: 99, since: 0, last: {} }, 7 * DAY), true, "an unknown `every` is a week");
  });
  await test("file names, rows and failures", () => {
    assert.strictEqual(D.fileName("app", ".zip", new Date(2026, 0, 2, 3, 4)), "app-2026-01-02-0304.zip");
    const rows = D.readList([{ id: "a", createdTime: "2026-01-01T00:00:00Z", size: "5" }, { id: "b", createdTime: "2026-02-01T00:00:00Z", appProperties: { device: "Pixel" } }]);
    assert.deepStrictEqual(rows.map((r) => [r.id, r.size, r.from]), [["b", 0, "Pixel"], ["a", 5, ""]]);
    assert.strictEqual(D.failure(401).code, "signin");
    assert.strictEqual(D.failure(403, { error: { errors: [{ reason: "storageQuotaExceeded" }] } }).code, "full");
    assert.strictEqual(D.failure(404).code, "gone");
    assert.strictEqual(D.failure(500).code, "500");
  });

  await test("connects, makes the folder once and keeps the app's own settings", async () => {
    const g = world();
    const { drive } = phone(g, { fresh: () => ({ what: { notes: true } }) });
    assert.strictEqual(drive.available, true);
    assert.strictEqual(await drive.connect(), "me@example.com");
    assert.strictEqual(drive.on, true);
    assert.strictEqual(drive.every, 7);
    assert.deepStrictEqual(drive.get("what"), { notes: true });
    const folders = [...g.files.values()].filter((f) => f.name === "Test");
    assert.strictEqual(folders.length, 1);
    assert.strictEqual(drive.folder, folders[0].id);
    // Another device finds the folder by name.
    const other = phone(g).drive;
    localStorage.removeItem(KEYS.cfg);
    const fresh = phone(g).drive;
    await fresh.connect();
    assert.strictEqual(fresh.folder, folders[0].id);
    assert.ok(other);
  });

  await test("backs up in pieces, tags the file and keeps three", async () => {
    const g = world();
    const { drive } = phone(g);
    await drive.connect();
    const text = JSON.stringify({ x: "y".repeat(100) });
    let heard = 0;
    for (let i = 0; i < 5; i++) await drive.upload({ text }, { device: "Pixel 8", props: { clips: "4" } }, () => heard++);
    assert.ok(heard >= 5, "no progress");
    const list = await drive.list();
    assert.strictEqual(list.length, 3);
    assert.ok(list[0].at > list[1].at, "not newest first");
    assert.strictEqual(list[0].from, "Pixel 8");
    assert.strictEqual(list[0].props.clips, "4");
    assert.match(list[0].name, /^test-\d{4}-\d\d-\d\d-\d{4}\.json$/);
    const f = g.files.get(list[0].id);
    assert.strictEqual(f.mimeType, "application/json");
    assert.strictEqual(f.description, "Test backup from Pixel 8");
    assert.strictEqual(await (await drive.download(list[0].id)).text(), text);
    await drive.remove(list[0].id);
    assert.strictEqual((await drive.list()).length, 2);
    await assert.rejects(drive.remove("nope"), (e) => e.code === "gone");
  });

  await test("a dead token is cleared from Play Services and asked for again", async () => {
    const g = world();
    const { drive, plugin } = phone(g);
    await drive.connect();
    g.token = "tok2";
    await drive.list();
    assert.deepStrictEqual(plugin.cleared, ["tok"]);
  });

  await test("a browser coming back from Google's page picks up the token and what it was doing", async () => {
    world({ hash: "#state=tdrive.r.abc.backup&access_token=webtok&expires_in=3599", store: { [KEYS.ask]: JSON.stringify("abc") } });
    const drive = D.create({ name: "Test", tag: "tdrive", keys: KEYS, webClient: "id", native: () => false, desktop: () => false });
    assert.strictEqual(location.hash, "", "the token stayed in the address");
    assert.strictEqual(drive.resume, "backup");
    assert.strictEqual(drive.closing, false);
    assert.strictEqual(drive.signedIn, true);
    assert.strictEqual(await drive.getToken(false), "webtok");
    assert.strictEqual(localStorage.getItem(KEYS.ask), null);
  });

  await test("a stranger's answer in the address is ignored", async () => {
    world({ hash: "#state=tdrive.r.zzz&access_token=evil", store: { [KEYS.ask]: JSON.stringify("abc") } });
    const drive = D.create({ name: "Test", tag: "tdrive", keys: KEYS, webClient: "id", native: () => false, desktop: () => false });
    assert.strictEqual(drive.signedIn, false);
    await assert.rejects(drive.getToken(false), (e) => e.code === "signin");
  });

  await test("a computer uses its refresh token, and forgets one Google refuses", async () => {
    const g = world({ store: { [KEYS.token]: JSON.stringify({ refresh: "r1" }) } });
    const opts = { name: "Test", tag: "tdrive", keys: KEYS, desktopClient: "dc", native: () => false, desktop: () => true, tauri: () => ({ core: {} }) };
    let drive = D.create(opts);
    assert.strictEqual(drive.available, true);
    assert.strictEqual(drive.signedIn, true);
    assert.strictEqual(await drive.getToken(false), "tok");
    g.refresh = "r2";
    drive = D.create(opts);
    await assert.rejects(drive.getToken(false), (e) => e.code === "signin");
    assert.strictEqual(localStorage.getItem(KEYS.token), null);
    assert.strictEqual(drive.signedIn, false);
  });

  await test("disconnecting forgets everything and revokes the access", async () => {
    const g = world({ store: { [KEYS.token]: JSON.stringify({ refresh: "r1" }) } });
    const drive = D.create({ name: "Test", tag: "tdrive", keys: KEYS, desktopClient: "dc", native: () => false, desktop: () => true, tauri: () => ({ core: {} }) });
    await drive.connect();
    await drive.disconnect();
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(drive.on, false);
    assert.strictEqual(localStorage.getItem(KEYS.cfg), null);
    assert.strictEqual(localStorage.getItem(KEYS.token), null);
    assert.deepStrictEqual(g.revoked, ["tok"]);
  });

  console.log(passed + " passed");
})();
