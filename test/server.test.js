// keel: server.js answers this computer only, serves only its own folder,
// and lives through a bad address (`node test/server.test.js`).
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const PORT = 5300 + Math.floor(Math.random() * 500);
// The server in a folder of its own, with a sibling whose name starts the same.
const top = fs.mkdtempSync(path.join(os.tmpdir(), "keel-server-"));
const app = path.join(top, "app");
fs.mkdirSync(app);
fs.mkdirSync(path.join(top, "app-backup"));
fs.copyFileSync(path.join(__dirname, "..", "server.js"), path.join(app, "server.js"));
fs.writeFileSync(path.join(app, "index.html"), "<p>hi</p>");
fs.writeFileSync(path.join(app, "keel.config.json"), '{ "name": "Test app" }');
fs.writeFileSync(path.join(top, "app-backup", "secret.txt"), "secret");

// A raw request, so the path reaches the server exactly as written.
const get = (p) => new Promise((resolve, reject) => {
  const req = http.request({ host: "127.0.0.1", port: PORT, path: p }, (res) => {
    let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => resolve({ status: res.statusCode, body }));
  });
  req.on("error", reject); req.end();
});

(async () => {
  let out = "";
  const child = spawn(process.execPath, [path.join(app, "server.js")], { env: { ...process.env, PORT: String(PORT) } });
  child.stdout.on("data", (c) => (out += c));
  for (let i = 0; i < 50 && !out.includes("running"); i++) await new Promise((r) => setTimeout(r, 100));
  let passed = 0;
  const test = async (name, fn) => {
    try { await fn(); passed++; console.log("  ok - " + name); }
    catch (e) { process.exitCode = 1; console.log("  FAIL - " + name + "\n    " + e.message); }
  };
  await test("names the app from keel.config.json", () => assert.ok(out.includes("Test app running"), out));
  await test("serves index.html at /", async () => assert.deepStrictEqual(await get("/"), { status: 200, body: "<p>hi</p>" }));
  await test("refuses a sibling folder that starts the same way", async () => assert.strictEqual((await get("/../app-backup/secret.txt")).status, 403));
  await test("answers a malformed address with 400 and keeps running", async () => {
    assert.strictEqual((await get("/%E0%A4%A")).status, 400);
    assert.strictEqual((await get("/")).status, 200);
  });
  await test("listens on 127.0.0.1 only", () => {
    const src = fs.readFileSync(path.join(app, "server.js"), "utf8");
    assert.match(src, /server\.listen\(PORT, "127\.0\.0\.1"/);
  });
  child.kill();
  fs.rmSync(top, { recursive: true, force: true });
  console.log(passed + " passed");
})();
