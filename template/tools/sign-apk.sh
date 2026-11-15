#!/usr/bin/env bash
# Signs the release APK Gradle built, as __APPNS__.apk.
#
# Android installs an update only over an app signed with the same key, so the
# key has to be the same one every time: it comes from two repository secrets,
# ANDROID_KEYSTORE_B64 (the .jks, base64) and ANDROID_KEYSTORE_PASSWORD. The
# key alias is "__SLUG__" and its password is the store's (README.md says how
# to make one).
#
# Without the secrets it still signs, with a throwaway key made on the spot,
# so the APK installs and can be tried — and reports signed=false, which is
# what keeps the workflow from publishing it as a release. A published
# throwaway-signed APK would be the one every later update refuses to install
# over.
set -euo pipefail

BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
IN=android/app/build/outputs/apk/release/app-release-unsigned.apk
KS="$RUNNER_TEMP/app.jks"

if [ -n "${KEYSTORE_B64:-}" ] && [ -n "${KEYSTORE_PASSWORD:-}" ]; then
  printf '%s' "$KEYSTORE_B64" | base64 -d > "$KS"
  export KS_PASS="$KEYSTORE_PASSWORD"
  echo "signed=true" >> "$GITHUB_OUTPUT"
else
  echo "::warning title=Unsigned build::No ANDROID_KEYSTORE_B64 / ANDROID_KEYSTORE_PASSWORD secrets, so this APK is signed with a throwaway key. It installs, but a later build won't install over it, and no release is published until the secrets are set."
  export KS_PASS="throwaway-$RANDOM$RANDOM"
  keytool -genkeypair -keystore "$KS" -alias __SLUG__ -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=__NAME__ (throwaway)" >/dev/null
  echo "signed=false" >> "$GITHUB_OUTPUT"
fi

"$BT/zipalign" -p -f 4 "$IN" "$RUNNER_TEMP/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias __SLUG__ \
  --ks-pass env:KS_PASS --key-pass env:KS_PASS \
  --out __APPNS__.apk "$RUNNER_TEMP/aligned.apk"
"$BT/apksigner" verify --print-certs __APPNS__.apk | head -3
rm -f "$KS"
