// keel: starts a new app from keel's template (keel only, never synced).
//
//   node tools/keel-new.js "<Name>" <folder>
//
// Writes template/ into the folder with the app's name in it, then brings
// in this keel's shared files as a sync would (keel.lock.json and all).
// The folder must be empty or not exist yet. What comes out is the web
// base every kind of app needs: the page with a strict CSP, the service
// worker with test builds, the update check, the tests (CSP, contrast,
// the app's own files) and the docs. Native builds come on top later.
const fs = require("fs");
const path = require("path");

const KEEL = path.resolve(__dirname, "..");
const TEMPLATE = path.join(KEEL, "template");

function names(name) {
  const words = String(name).trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length || !/^[A-Za-z]/.test(words[0])) throw new Error("the name has to start with a letter: " + name);
  return {
    __NAME__: String(name).trim(),
    __SLUG__: words.join("-").toLowerCase(),
    __APPNS__: words.map((w) => w[0].toUpperCase() + w.slice(1)).join(""),
  };
}

function create(name, dir, { date = new Date().toISOString().slice(0, 10) } = {}) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(dir + " isn't empty");
  const words = { ...names(name), __DATE__: date };
  const fill = (t) => t.replace(/__(NAME|SLUG|APPNS|DATE)__/g, (m) => words[m]);
  const written = [];
  (function walk(rel) {
    for (const e of fs.readdirSync(path.join(TEMPLATE, rel), { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) { walk(r); continue; }
      const to = path.join(dir, r);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, fill(fs.readFileSync(path.join(TEMPLATE, r), "utf8")));
      written.push(r.split(path.sep).join("/"));
    }
  })("");
  const { sync } = require("./keel-sync.js");
  const synced = sync(KEEL, { root: dir });
  return { written, synced };
}

if (require.main === module) {
  const [name, dir] = process.argv.slice(2);
  if (!name || !dir) { console.error('node tools/keel-new.js "<Name>" <folder>'); process.exit(1); }
  try {
    create(name, path.resolve(dir));
    console.log(name + " is in " + dir + ". Next: git init, node test/run-all.js, push it, turn on GitHub Pages from main.");
  } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { create, names };
