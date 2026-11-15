// keel: starts a new app from keel's template (keel only, never synced).
//
//   node tools/keel-new.js "<Name>" <folder> [--owner <github user>]
//
// Writes template/ into the folder with the app's name in it, then brings
// in this keel's shared files as a sync would (keel.lock.json and all).
// The folder must be empty or not exist yet. What comes out is an app on
// the web, the phones (Capacitor) and Windows and Linux (Tauri): the page
// with a strict CSP, the service worker with test builds, the update
// check, motion, the tests, the docs and the build workflows. The owner
// (danielnoam unless given) goes into the app id, io.github.<owner>.<name>,
// and the desktop app's GitHub addresses.
const fs = require("fs");
const path = require("path");

const KEEL = path.resolve(__dirname, "..");
const TEMPLATE = path.join(KEEL, "template");

function names(name, owner = "danielnoam") {
  const words = String(name).trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length || !/^[A-Za-z]/.test(words[0])) throw new Error("the name has to start with a letter: " + name);
  if (!/^[A-Za-z0-9-]+$/.test(owner)) throw new Error("not a GitHub user: " + owner);
  // Android and iOS take letters, digits and dots, each part starting with a letter.
  const idPart = (s) => { const p = s.toLowerCase().replace(/[^a-z0-9]/g, ""); return /^[a-z]/.test(p) ? p : "x" + p; };
  return {
    __NAME__: String(name).trim(),
    __SLUG__: words.join("-").toLowerCase(),
    __APPNS__: words.map((w) => w[0].toUpperCase() + w.slice(1)).join(""),
    __OWNER__: owner,
    __APPID__: "io.github." + idPart(owner) + "." + idPart(words.join("")),
  };
}

function create(name, dir, { date = new Date().toISOString().slice(0, 10), owner } = {}) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(dir + " isn't empty");
  const words = { ...names(name, owner), __DATE__: date };
  const fill = (t) => t.replace(/__(NAME|SLUG|APPNS|OWNER|APPID|DATE)__/g, (m) => words[m]);
  const written = [];
  (function walk(rel) {
    for (const e of fs.readdirSync(path.join(TEMPLATE, rel), { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) { walk(r); continue; }
      const to = path.join(dir, r);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, fill(fs.readFileSync(path.join(TEMPLATE, r), "utf8")));
      if (r.endsWith(".sh")) fs.chmodSync(to, 0o755);
      written.push(r.split(path.sep).join("/"));
    }
  })("");
  const { sync } = require("./keel-sync.js");
  const synced = sync(KEEL, { root: dir });
  return { written, synced };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--owner");
  const owner = at >= 0 ? args.splice(at, 2)[1] : undefined;
  const [name, dir] = args;
  if (!name || !dir) { console.error('node tools/keel-new.js "<Name>" <folder> [--owner <github user>]'); process.exit(1); }
  try {
    create(name, path.resolve(dir), { owner });
    console.log(name + " is in " + dir + ". Next: git init, node test/run-all.js, npm install (for the lock file), push it, then README.md's \"Setting up the builds\".");
  } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { create, names };
