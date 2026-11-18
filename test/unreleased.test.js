// keel: tools/unreleased.js (`node test/unreleased.test.js`).
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const U = require("../tools/unreleased.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + (e && e.stack || e)); }
}

test("a build's note", () => {
  assert.deepStrictEqual(U.note("android", "out/App.apk", { version: "1.2.0", sha: "abc", at: "t" }), { kind: "android", file: "App.apk", version: "1.2.0", sha: "abc", at: "t" });
  assert.throws(() => U.note("ios", "App.ipa", { version: "1" }));
  assert.throws(() => U.note("android", "a b.apk", { version: "1" }));
});

test("the newest artifact of main, not a branch's or an expired one", () => {
  const list = [
    { name: "unreleased-android", created_at: "2026-11-03T00:00:00Z", expired: true, workflow_run: { id: 1, head_branch: "main" } },
    { name: "unreleased-android", created_at: "2026-11-02T00:00:00Z", workflow_run: { id: 2, head_branch: "main" } },
    { name: "unreleased-android", created_at: "2026-11-04T00:00:00Z", workflow_run: { id: 3, head_branch: "fix/x" } },
    { name: "unreleased-android", created_at: "2026-11-01T00:00:00Z", workflow_run: { id: 4, head_branch: "main" } },
    { name: "unreleased-windows", created_at: "2026-11-05T00:00:00Z", workflow_run: { id: 5, head_branch: "main" } },
  ];
  assert.strictEqual(U.newest(list, "android").workflow_run.id, 2);
  assert.strictEqual(U.newest(list, "windows").workflow_run.id, 5);
  assert.strictEqual(U.newest([], "android"), null);
});

test("build.json keeps plain file names that are there", () => {
  const m = U.manifest([
    { kind: "android", file: "App.apk", version: "1.2.0", sha: "a", at: "t" },
    { kind: "windows", file: "../evil.exe", version: "1", sha: "b", at: "t" },
    { kind: "linux", file: "App.AppImage" },
  ]);
  assert.deepStrictEqual(m, { android: { version: "1.2.0", sha: "a", at: "t", file: "App.apk" } });
  assert.deepStrictEqual(U.manifest([{ kind: "android", file: "App.apk" }], () => false), {});
});

test("fetch puts each kind's file and build.json in the folder, and goes on past a missing kind", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "unrel-out-"));
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    if (args[0] === "api") {
      const kind = /unreleased-(\w+)/.exec(args[1])[1];
      if (kind === "windows") return JSON.stringify({ artifacts: [] });
      return JSON.stringify({ artifacts: [{ name: "unreleased-android", created_at: "2026-11-02T00:00:00Z", workflow_run: { id: 77, head_branch: "main" } }] });
    }
    const dir = args[args.indexOf("-D") + 1];
    fs.writeFileSync(path.join(dir, "App.apk"), "apk");
    fs.writeFileSync(path.join(dir, "unreleased-android.json"), JSON.stringify({ kind: "android", file: "App.apk", version: "1.2.0", sha: "abc", at: "t" }));
    return "";
  };
  const errors = console.error;
  console.error = () => {};
  try { U.fetchAll(out, { repo: "me/app", gh }); } finally { console.error = errors; }
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(out, "build.json"), "utf8")), { android: { version: "1.2.0", sha: "abc", at: "t", file: "App.apk" } });
  assert.strictEqual(fs.readFileSync(path.join(out, "App.apk"), "utf8"), "apk");
  assert.deepStrictEqual(calls[1], ["run", "download", "77", "-R", "me/app", "-n", "unreleased-android", "-D", calls[1][8]]);
});

console.log(passed + " passed");
