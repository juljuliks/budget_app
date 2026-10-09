#!/usr/bin/env bash
# Screenshots for the public documentation, on the running emulator with the app installed (npm run emulator):
# the demo database (demoDb.ts) in place of the app's, the flows of flows/docs/ one after another, two bank SMS for
# the notifications. The PNGs are gathered into OUT_DIR (default e2e-out/docs). The app's own data on the emulator is
# replaced; the Messages app's notifications are muted while shooting and unmuted after.
# Usage: scripts/demo/docs.sh [OUT_DIR]   (FLOWS="3-stats 4-notifications" scripts/demo/docs.sh — only those, the other
# shots in OUT_DIR kept)
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$PWD"
OUT="${1:-$ROOT/e2e-out/docs}"
A="adb -s emulator-5554"; PKG=com.budgetapp; DIR=/data/data/$PKG/files; M=com.google.android.apps.messaging
MAESTRO="$HOME/.maestro/bin/maestro"
FLOWS="${FLOWS:-}"
if [ -z "$FLOWS" ]; then rm -rf "$OUT"; fi
mkdir -p "$OUT"
wants() { [ -z "$FLOWS" ] || [[ " $FLOWS " == *" $1 "* ]]; }

npx tsc -p scripts/demo
node dist-demo/scripts/demo/demoDb.js "$OUT/demo.db"

load() {
  $A root >/dev/null; sleep 2; $A wait-for-device
  $A shell am force-stop $PKG
  local owner; owner="$($A shell stat -c %u:%g /data/data/$PKG | tr -d '\r')"
  $A shell rm -f $DIR/app.db $DIR/app.db-wal $DIR/app.db-shm
  $A push "$OUT/demo.db" $DIR/app.db >/dev/null
  $A shell chown "$owner" $DIR/app.db; $A shell chmod 660 $DIR/app.db; $A shell restorecon $DIR/app.db || true
  $A shell am start -n $PKG/.MainActivity >/dev/null; sleep 8
}
shoot() {
  local flow="$1" run
  (cd "$OUT" && "$MAESTRO" test --test-output-dir "$OUT/maestro/$flow" "$ROOT/scripts/demo/flows/docs/$flow.yaml") || echo "warning: $flow not shot whole"
  find "$OUT/maestro/$flow" "$HOME/.maestro/tests" -path "*takeScreenshot*" -name '*.png' -newer "$OUT/demo.db" -exec cp {} "$OUT/" \; 2>/dev/null || true
}

$A shell settings put global hide_error_dialogs 1
$A shell pm grant $PKG android.permission.RECEIVE_SMS
$A shell pm grant $PKG android.permission.POST_NOTIFICATIONS
for flow in 1-operations 2-settings 3-stats; do if wants "$flow"; then load; shoot "$flow"; fi; done
wants 4-notifications || exit 0

# the notifications: two bank SMS to the closed app — a new merchant (category buttons) and CAVEA (Развлечения to 85%)
load
$A shell cmd appops set $M POST_NOTIFICATION ignore; $A shell am force-stop $M
$A shell am force-stop $PKG; sleep 1
D=$(date +%d/%m/%Y); T=$(date +%H:%M)
$A emu sms send TBC "170.00GEL\n(*1234)\nCAVEA\nBalance: 2601.17GEL\n$D $T" >/dev/null; sleep 6
$A emu sms send TBC "23.40GEL\n(*1234)\nPASHA COFFEE\nBalance: 2577.77GEL\n$D $T" >/dev/null; sleep 8
$A shell cmd statusbar collapse
shoot 4-notifications
$A shell cmd statusbar collapse
$A shell cmd appops set $M POST_NOTIFICATION allow
ls "$OUT"/*.png | wc -l
