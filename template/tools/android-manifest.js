// Adds what __NAME__ needs to the AndroidManifest.xml `npx cap add android`
// writes.
//
//   node tools/android-manifest.js
//
// - REQUEST_INSTALL_PACKAGES, for the in-app update: without it Android
//   refuses to install an APK an app hands it. The person still approves
//   each install on Android's own screen.
// - No cloud backup: allowBackup="false" on <application>. The WebView's
//   storage holds everything the app keeps, tokens included, and
//   Capacitor's template has allowBackup="true", which would put it in the
//   phone's Google backup. The template's attribute is replaced, not
//   skipped, which is what the `replace` flag is for.
//
// An app adds its own entries to the lists below. Idempotent, and fails
// loudly if a tag it needs isn't there.
const fs = require("fs");
const path = require("path");

const ENTRIES = [
  { inside: "manifest", xml: '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />' },
];
const ATTRS = [
  { on: "application", attr: 'android:allowBackup="false"', replace: true },
];

function patch(xml) {
  let out = xml;
  for (const { inside, xml: entry } of ENTRIES) {
    const name = entry.match(/android:name="([^"]+)"/)[1];
    if (out.includes('android:name="' + name + '"')) continue;
    const at = out.search(inside === "application" ? /<application\b[^>]*>/ : /<manifest\b[^>]*>/);
    if (at < 0) throw new Error("no <" + inside + "> tag in AndroidManifest.xml");
    const end = out.indexOf(">", at) + 1;
    out = out.slice(0, end) + "\n    " + (inside === "application" ? "    " : "") + entry + out.slice(end);
  }
  for (const { on, attr, replace } of ATTRS) {
    const name = attr.split("=")[0];
    const m = new RegExp("<" + on + "\\b[^>]*>").exec(out);
    if (!m) throw new Error("no <" + on + "> tag in AndroidManifest.xml");
    let tag;
    if (m[0].includes(name + "=")) {
      if (!replace || m[0].includes(attr)) continue;
      tag = m[0].replace(new RegExp(name + '="[^"]*"'), attr);
    } else {
      tag = m[0].replace(new RegExp("^<" + on), "<" + on + " " + attr);
    }
    out = out.slice(0, m.index) + tag + out.slice(m.index + m[0].length);
  }
  return out;
}

if (require.main === module) {
  const file = path.resolve(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");
  const before = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, patch(before));
  console.log("android: manifest " + (before === patch(before) ? "already had" : "gained") + " __NAME__'s entries");
}
module.exports = { patch, ENTRIES, ATTRS };
