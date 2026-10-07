#!/usr/bin/env bash
# On a booted emulator (CI: .github/workflows/android-release.yml): installs the APK, puts the demo database in place
# of the app's and shoots the screens of flows/screens.yaml with Maestro into OUT_DIR.
# Usage: scripts/demo/screenshots.sh app.apk demo.db OUT_DIR
set -euo pipefail
APK="$1"; DEMO_DB="$2"; OUT="$3"
PKG=com.budgetapp
FLOWS="$(cd "$(dirname "$0")" && pwd)/flows"
mkdir -p "$OUT"

adb install -r "$APK"
adb shell pm grant "$PKG" android.permission.RECEIVE_SMS || true
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS || true

# a first start creates the app's files dir (and an empty database); then the demo one replaces it.
# A google_apis image lets adb run as root, so the app's private files can be written.
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 15
adb shell am force-stop "$PKG"
adb root
sleep 3
adb wait-for-device
DIR="/data/data/$PKG/files"
OWNER="$(adb shell stat -c %u:%g "/data/data/$PKG" | tr -d '\r')"
adb shell rm -f "$DIR/app.db" "$DIR/app.db-wal" "$DIR/app.db-shm" "$DIR/app.db-journal"
adb push "$DEMO_DB" "$DIR/app.db"
adb shell chown "$OWNER" "$DIR/app.db"
adb shell chmod 660 "$DIR/app.db"
adb shell restorecon "$DIR/app.db" || true

# Maestro saves a flow's screenshots next to the flow file: run a copy of it in OUT
cp "$FLOWS/screens.yaml" "$OUT/"
cd "$OUT"
"$HOME/.maestro/bin/maestro" test screens.yaml || echo "::warning::Some screens could not be shot"
rm -f screens.yaml
adb exec-out screencap -p > 99-last.png || true
ls -la
