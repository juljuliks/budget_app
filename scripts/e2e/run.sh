#!/usr/bin/env bash
# End-to-end flows of the app on a running emulator (or a phone over adb that allows root: a google_apis emulator
# image does). Each flow starts from the same database (seed.ts) put in place of the app's, runs its Maestro steps
# (flows/*.yaml: taps and checks of what the screens say), then the database is pulled back and checked (verify.ts).
# A flow is red when a step can't find what it waits for, or the database isn't what it should be.
#
# Usage: scripts/e2e/run.sh [app.apk] [flow ...]
#   app.apk  installed first (else the app already installed is used)
#   flow     names from flows/ (default: all), e.g. delete-sort-out
# A flow may have flows/<flow>.sh: run with "before" ahead of Maestro (send SMS, revoke a permission: what Maestro
# can't do) and with "after" once it is done (check the notifications). It gets ADB, DIR (the app's files) and OUT.
# Needs: adb, maestro (curl -fsSL https://get.maestro.mobile.dev | bash), node + npm ci.
# Output (Maestro's screenshots of a failing step, logcat, the pulled database): e2e-out/<flow>/
set -euo pipefail
cd "$(dirname "$0")/../.."
PKG=com.budgetapp
DIR="/data/data/$PKG/files"
OUT="$PWD/e2e-out"
mkdir -p "$OUT"

APK=""
if [ "${1:-}" != "" ] && [ "${1##*.}" = "apk" ]; then APK="$1"; shift; fi
FLOWS=("$@")
if [ ${#FLOWS[@]} -eq 0 ]; then
  for f in scripts/e2e/flows/*.yaml; do FLOWS+=("$(basename "$f" .yaml)"); done
fi

npx tsc -p scripts/e2e

adb root >/dev/null; sleep 2; adb wait-for-device
if [ -n "$APK" ]; then adb install -r "$APK"; fi
adb shell settings put global hide_error_dialogs 1 || true
# a first start creates the app's files dir
adb shell am start -n "$PKG/.MainActivity" >/dev/null; sleep 8
OWNER="$(adb shell stat -c %u:%g "/data/data/$PKG" | tr -d '\r')"

failed=()
for flow in "${FLOWS[@]}"; do
  echo "── $flow"
  F="$OUT/$flow"; rm -rf "$F"; mkdir -p "$F"
  node dist-e2e/scripts/e2e/seed.js "$flow" "$F/seed.db" >/dev/null
  adb shell am force-stop "$PKG"
  adb shell rm -f "$DIR/app.db" "$DIR/app.db-wal" "$DIR/app.db-shm" "$DIR/app.db-journal"
  adb push "$F/seed.db" "$DIR/app.db" >/dev/null
  adb shell chown "$OWNER" "$DIR/app.db"; adb shell chmod 660 "$DIR/app.db"; adb shell restorecon "$DIR/app.db" || true
  adb logcat -c || true
  # every flow starts with the permissions a set-up app has (a flow's script may take one away)
  adb shell pm grant "$PKG" android.permission.RECEIVE_SMS || true
  adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS || true
  adb shell pm revoke "$PKG" android.permission.READ_SMS 2>/dev/null || true

  ok=1
  HOOK="scripts/e2e/flows/$flow.sh"
  if [ -f "$HOOK" ]; then ADB=adb DIR="$DIR" OUT="$F" bash "$HOOK" before || ok=0; fi
  if [ $ok = 1 ]; then maestro test "scripts/e2e/flows/$flow.yaml" --test-output-dir "$F" || ok=0; fi
  if [ $ok = 1 ] && [ -f "$HOOK" ]; then ADB=adb DIR="$DIR" OUT="$F" bash "$HOOK" after || ok=0; fi
  adb logcat -d > "$F/logcat.txt" || true
  adb shell am force-stop "$PKG"
  # the database with its WAL: the last changes may still be there
  for x in app.db app.db-wal app.db-shm; do adb pull "$DIR/$x" "$F/$x" >/dev/null 2>&1 || true; done
  if [ $ok = 1 ]; then node dist-e2e/scripts/e2e/verify.js "$flow" "$F/app.db" || ok=0; fi
  # a JS error during the flow is a failure too
  # (console.error only: warnings such as "rates not loaded" offline are not failures)
  if grep -E " E ReactNativeJS" "$F/logcat.txt" > "$F/js-errors.txt"; then
    echo "JS errors during $flow:"; cat "$F/js-errors.txt"; ok=0
  fi
  if [ $ok = 1 ]; then echo "✓ $flow"; else echo "✕ $flow (see $F)"; failed+=("$flow"); fi
done

echo
if [ ${#failed[@]} -gt 0 ]; then echo "failed: ${failed[*]}"; exit 1; fi
echo "all ${#FLOWS[@]} flows passed"
