// Adds what __NAME__ needs to the iOS project `npx cap add ios` writes, and
// stamps the version.
//
//   node tools/ios-project.js
//
// Info.plist gains ITSAppUsesNonExemptEncryption = false (the app uses only
// the system's HTTPS), which spares a question on every upload once there's
// a developer account and TestFlight. An app adds its own keys to PLIST
// (a camera reason, Files app sharing, a URL scheme).
//
// project.pbxproj gets MARKETING_VERSION = APP_VERSION and
// CURRENT_PROJECT_VERSION = the number Android's versionCode is, so a build
// is always higher than the one before without a second counter.
//
// Idempotent, and fails loudly if what it edits isn't where it expects.
const fs = require("fs");
const path = require("path");
const { appVersion } = require("./build-www");
const { versionCode } = require("./android-version");

const PLIST = [
  ["ITSAppUsesNonExemptEncryption", "<false/>"],
];

function patchPlist(xml) {
  let out = xml;
  for (const [key, value] of PLIST) {
    if (out.includes("<key>" + key + "</key>")) continue;
    const end = out.lastIndexOf("</dict>");
    if (end < 0 || !/<plist\b/.test(out)) throw new Error("Info.plist has no top-level <dict>");
    out = out.slice(0, end) + "\t<key>" + key + "</key>\n\t" + value + "\n" + out.slice(end);
  }
  return out;
}

function stampPbxproj(src, v) {
  if (!/MARKETING_VERSION = [^;]+;/.test(src) || !/CURRENT_PROJECT_VERSION = [^;]+;/.test(src)) {
    throw new Error("project.pbxproj has no MARKETING_VERSION / CURRENT_PROJECT_VERSION to stamp");
  }
  return src
    .replace(/MARKETING_VERSION = [^;]+;/g, "MARKETING_VERSION = " + v + ";")
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, "CURRENT_PROJECT_VERSION = " + versionCode(v) + ";");
}

if (require.main === module) {
  const app = path.resolve(__dirname, "..", "ios", "App");
  const plist = path.join(app, "App", "Info.plist");
  const pbx = path.join(app, "App.xcodeproj", "project.pbxproj");
  const v = appVersion();
  fs.writeFileSync(plist, patchPlist(fs.readFileSync(plist, "utf8")));
  fs.writeFileSync(pbx, stampPbxproj(fs.readFileSync(pbx, "utf8"), v));
  console.log("ios: Info.plist has " + PLIST.length + " __NAME__ key(s); version " + v + " (" + versionCode(v) + ")");
}
module.exports = { patchPlist, stampPbxproj, PLIST };
