// keel: src/keel/github.js against a small fake of GitHub's API
// (`node test/github.test.js`).
const assert = require("assert");
global.window = {};
global.atob = (s) => Buffer.from(s, "base64").toString("binary");
global.btoa = (s) => Buffer.from(s, "binary").toString("base64");
require("../src/keel/github.js");
const G = window.Keel.github;

// One repo, one branch per ref, contents as files with git-like shas.
function fakeGitHub({ big = 1024 * 1024 } = {}) {
  let n = 0;
  const sha = () => "s" + String(++n).padStart(39, "0");
  const blobs = {}; const commits = {}; const trees = {}; const refs = {};
  const calls = [];
  const files = () => trees[commits[refs.main].tree];
  const tree0 = sha(); trees[tree0] = {};
  const c0 = sha(); commits[c0] = { tree: tree0, parents: [] }; refs.main = c0;
  const commitTree = (branch, t, msg) => { const c = sha(); commits[c] = { tree: t, parents: refs[branch] ? [refs[branch]] : [], msg }; refs[branch] = c; };
  const res = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300, status,
    headers: { get: (k) => headers[k.toLowerCase()] || null },
    json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    arrayBuffer: async () => Buffer.from(body),
  });
  const api = {
    raw: { calls, blobs, refs, commits, trees, files },
    fail: null,
    put(path, text) { const s = sha(); blobs[s] = Buffer.from(text).toString("base64"); const t = sha(); trees[t] = { ...files(), [path]: s }; commitTree("main", t, "seed"); return s; },
    async fetch(url, opts) {
      const u = new URL(url); const m = opts.method || "GET"; const body = opts.body ? JSON.parse(opts.body) : null;
      calls.push(m + " " + u.pathname);
      if (api.fail) { const f = api.fail; api.fail = null; if (f === "offline") throw new TypeError("Failed to fetch"); return res(f.status, f.body || { message: f.message || "" }, f.headers); }
      if (opts.headers.Authorization !== "Bearer tok") return res(401, { message: "Bad credentials" });
      const p = decodeURIComponent(u.pathname);
      if (p === "/user") return res(200, { login: "me" });
      const mm = p.match(/^\/repos\/me\/data(?:\/(.*))?$/);
      if (!mm) return res(404, { message: "Not Found" });
      const rest = mm[1] || "";
      if (!rest) return res(200, { private: true, default_branch: "main", size: 12 });
      if (rest.startsWith("contents")) {
        const path = rest.slice(9);
        if (m === "GET") {
          const tr = files();
          if (!path || !tr[path]) {
            const dir = path ? path + "/" : "";
            const list = Object.keys(tr).filter((f) => f.startsWith(dir) && !f.slice(dir.length).includes("/")).map((f) => ({ path: f, sha: tr[f] }));
            return path && !list.length ? res(404, { message: "Not Found" }) : res(200, list);
          }
          const s = tr[path]; const b64 = blobs[s]; const size = Buffer.from(b64, "base64").length;
          if (opts.headers["If-None-Match"] === '"' + s + '"') return res(304, "");
          if (opts.headers.Accept === "application/vnd.github.raw") return res(200, Buffer.from(b64, "base64").toString("binary"));
          return res(200, { sha: s, size, content: size > big ? "" : b64 }, { etag: '"' + s + '"' });
        }
        if (m === "PUT") {
          const cur = files()[path];
          if ((cur || null) !== (body.sha || null)) return res(409, { message: "is at " + cur + " but expected " + body.sha });
          const s = sha(); blobs[s] = body.content; const t = sha(); trees[t] = { ...files(), [path]: s }; commitTree(body.branch, t, body.message);
          return res(201, { content: { sha: s } });
        }
        if (m === "DELETE") {
          if (!files()[path]) return res(404, { message: "Not Found" });
          const t = sha(); const tr = { ...files() }; delete tr[path]; trees[t] = tr; commitTree("main", t, body.message);
          return res(200, {});
        }
      }
      let g;
      if ((g = rest.match(/^git\/blobs\/(.+)$/))) return res(200, { content: blobs[g[1]] });
      if (rest === "git/blobs") { const s = sha(); blobs[s] = body.encoding === "base64" ? body.content : Buffer.from(body.content).toString("base64"); return res(201, { sha: s }); }
      if ((g = rest.match(/^git\/ref\/heads\/(.+)$/))) return refs[g[1]] ? res(200, { object: { sha: refs[g[1]] } }) : res(404, { message: "Not Found" });
      if ((g = rest.match(/^git\/commits\/(.+)$/))) return res(200, { tree: { sha: commits[g[1]].tree } });
      if (rest === "git/trees") {
        const t = sha(); const tr = body.base_tree ? { ...trees[body.base_tree] } : {};
        for (const e of body.tree) {
          if (e.content != null) { const s = sha(); blobs[s] = Buffer.from(e.content).toString("base64"); tr[e.path] = s; }
          else if (e.sha === null) delete tr[e.path]; else tr[e.path] = e.sha;
        }
        trees[t] = tr; return res(201, { sha: t });
      }
      if (rest === "git/commits") { const c = sha(); commits[c] = { tree: body.tree, parents: body.parents, msg: body.message }; return res(201, { sha: c }); }
      if (rest === "git/refs") { const b = body.ref.replace("refs/heads/", ""); if (refs[b]) return res(422, { message: "Reference already exists" }); refs[b] = body.sha; return res(201, {}); }
      if ((g = rest.match(/^git\/refs\/heads\/(.+)$/)) && m === "PATCH") {
        if (api.moveFirst) { const f = api.moveFirst; api.moveFirst = null; f(); }
        if (!commits[body.sha].parents.includes(refs[g[1]])) return res(422, { message: "Update is not a fast forward" });
        refs[g[1]] = body.sha; return res(200, {});
      }
      if (rest.startsWith("commits")) return res(200, [{ sha: refs.main, commit: { message: "Last\nmore", author: { date: "2026-11-15T00:00:00Z" } }, parents: [{ sha: "p" }] }]);
      return res(404, { message: "Not Found " + rest });
    },
  };
  return api;
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const setup = (o) => { const f = fakeGitHub(o); const cfg = { token: "tok", owner: "me", repo: "data", branch: "main" }; return { f, cfg, gh: G.client(() => cfg, { fetch: f.fetch }) }; };

test("text that isn't ASCII survives base64 both ways", () => {
  const s = "שלום — café 🚀";
  assert.strictEqual(G.b64decode(G.b64encode(s)), s);
  const bytes = new Uint8Array([0, 255, 1, 128, 64]);
  assert.deepStrictEqual([...G.base64ToBytes(G.bytesToBase64(bytes))], [...bytes]);
});

test("blobSha is git's sha for the bytes", async () => {
  assert.strictEqual(await G.blobSha("hello\n"), "ce013625030ba8dba906f756967f9e9ca394464a");
});

test("me, repoInfo, and getJson's null for a file that isn't there", async () => {
  const { gh } = setup();
  assert.strictEqual(await gh.me(), "me");
  assert.strictEqual((await gh.repoInfo()).private, true);
  assert.strictEqual(await gh.repoInfo("me", "nope"), null);
  assert.strictEqual(await gh.getJson("library.json"), null);
});

test("a file past 1 MB comes from its blob, with the same sha", async () => {
  const { f, gh } = setup({ big: 10 });
  const s = f.put("big.json", JSON.stringify({ many: "x".repeat(50) }));
  const got = await gh.getJson("big.json");
  assert.strictEqual(got.sha, s);
  assert.strictEqual(got.data.many.length, 50);
  assert.ok(f.raw.calls.some((c) => c.includes("/git/blobs/")));
});

test("an unchanged file with its etag is notModified", async () => {
  const { f, gh } = setup();
  f.put("a.json", "{}");
  const first = await gh.getFile("a.json");
  assert.deepStrictEqual(await gh.getFile("a.json", { etag: first.etag }), { notModified: true });
});

test("putFile writes, and a stale sha is a 409 with kind other", async () => {
  const { gh } = setup();
  const s1 = await gh.putFile("a.json", { text: '{"v":1}', message: "one" });
  await gh.putFile("a.json", { text: '{"v":2}', sha: s1, message: "two" });
  await assert.rejects(gh.putFile("a.json", { text: '{"v":3}', sha: s1 }), (e) => e.status === 409 && e.kind === "other");
  assert.deepStrictEqual((await gh.getJson("a.json")).data, { v: 2 });
});

test("saveFile merges onto what another device wrote", async () => {
  const { f, gh } = setup();
  const old = f.put("a.json", '{"items":[1]}');
  f.put("a.json", '{"items":[1,2]}');
  const r = await gh.saveFile("a.json", {
    text: '{"items":[1,3]}', sha: old, message: "save",
    onConflict: (cur) => JSON.stringify({ items: [...new Set([...JSON.parse(cur.text).items, 3])] }),
  });
  assert.strictEqual(r.conflicted, true);
  assert.deepStrictEqual((await gh.getJson("a.json")).data, { items: [1, 2, 3] });
});

test("saveFile without onConflict writes over the newer copy", async () => {
  const { f, gh } = setup();
  f.put("a.txt", "theirs");
  const r = await gh.saveFile("a.txt", { text: "mine", sha: null });
  assert.strictEqual(r.conflicted, true);
  assert.strictEqual(await gh.getRaw("a.txt"), "mine");
});

test("removeFile doesn't mind a file already gone", async () => {
  const { f, gh } = setup();
  const s = f.put("a.txt", "x");
  await gh.removeFile("a.txt", s);
  await gh.removeFile("a.txt", s);
  assert.strictEqual(await gh.getRaw("a.txt"), null);
});

test("commitFiles makes one commit, and remakes it when the branch moved", async () => {
  const { f, gh } = setup();
  f.put("keep.txt", "k");
  f.moveFirst = () => f.put("other.txt", "o");
  const bsha = await gh.createBlob(new Uint8Array([1, 2, 3]));
  await gh.commitFiles([{ path: "pages/1.html", text: "<p>1</p>" }, { path: "pages/1/pack-0", sha: bsha }, { path: "keep.txt", sha: null }], "Pages: 1");
  const tr = f.raw.files();
  assert.deepStrictEqual(Object.keys(tr).sort(), ["other.txt", "pages/1.html", "pages/1/pack-0"]);
  assert.strictEqual(await gh.getRaw("pages/1.html"), "<p>1</p>");
});

test("commitFiles starts a missing branch from root, and refuses without it", async () => {
  const { f, gh } = setup();
  const readme = await gh.createBlob("hi");
  await gh.commitFiles([{ path: "images/a", sha: await gh.createBlob("img") }], "Add", { branch: "pics", root: [{ path: "README.md", sha: readme }] });
  assert.ok(f.raw.refs.pics);
  assert.deepStrictEqual(Object.keys(f.raw.trees[f.raw.commits[f.raw.refs.pics].tree]).sort(), ["README.md", "images/a"]);
  await assert.rejects(gh.commitFiles([{ path: "x", text: "x" }], "m", { branch: "none" }), (e) => e.status === 404);
});

test("peekSha reads the sha from the folder's listing", async () => {
  const { f, gh } = setup();
  const s = f.put("data/lifelog.json", "{}");
  assert.strictEqual(await gh.peekSha("data/lifelog.json"), s);
  assert.strictEqual(await gh.peekSha("data/none.json"), undefined);
});

test("errors carry a kind: offline, auth, ratelimit, server", async () => {
  const { f, gh, cfg } = setup();
  f.fail = "offline";
  await assert.rejects(gh.me(), (e) => e.kind === "offline");
  cfg.token = "wrong";
  await assert.rejects(gh.me(), (e) => e.kind === "auth" && e.status === 401 && e.detail === "Bad credentials");
  cfg.token = "tok";
  f.fail = { status: 403, message: "API rate limit exceeded" };
  await assert.rejects(gh.me(), (e) => e.kind === "ratelimit");
  f.fail = { status: 403, message: "", headers: { "x-ratelimit-remaining": "0" } };
  await assert.rejects(gh.me(), (e) => e.kind === "ratelimit");
  f.fail = { status: 403, message: "Resource not accessible" };
  await assert.rejects(gh.me(), (e) => e.kind === "auth");
  f.fail = { status: 502 };
  await assert.rejects(gh.me(), (e) => e.kind === "server");
});

test("listCommits gives sha, date, first line and parent", async () => {
  const { gh } = setup();
  const [c] = await gh.listCommits("lifelog.json");
  assert.deepStrictEqual(Object.keys(c), ["sha", "date", "message", "parent"]);
  assert.strictEqual(c.message, "Last");
});

(async () => {
  let passed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); passed++; console.log("  ok - " + name); }
    catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e.stack || e.message)); }
  }
  console.log(passed + " passed");
})();
