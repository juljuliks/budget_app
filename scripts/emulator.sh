#!/usr/bin/env bash
# Starts an Android 13 emulator (creates the AVD on first run), installs the app and grants permissions.
# Usage: ./scripts/emulator.sh [release|debug]   (default: release — works without Metro)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
AVD_NAME="budget_pixel"
IMAGE="system-images;android-33;google_apis;arm64-v8a"
VARIANT="${1:-release}"
ADB="$SDK/platform-tools/adb"
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"

if ! "$SDK/emulator/emulator" -list-avds | grep -qx "$AVD_NAME"; then
  echo "Creating AVD $AVD_NAME..."
  echo no | "$SDK/cmdline-tools/latest/bin/avdmanager" create avd -n "$AVD_NAME" -k "$IMAGE" -d pixel_5
fi

if ! "$ADB" devices | grep -q "^emulator-"; then
  echo "Starting emulator..."
  nohup "$SDK/emulator/emulator" -avd "$AVD_NAME" -no-snapshot-save -no-boot-anim >/tmp/budget_emulator.log 2>&1 &
fi

echo "Waiting for boot..."
"$ADB" wait-for-device
until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done

cd "$ROOT_DIR/android"
if [ "$VARIANT" = "release" ]; then
  ./gradlew assembleRelease -q
  APK=app/build/outputs/apk/release/app-release.apk
else
  ./gradlew assembleDebug -q -PreactNativeArchitectures=arm64-v8a
  APK=app/build/outputs/apk/debug/app-debug.apk
  "$ADB" reverse tcp:8081 tcp:8081
fi

# debug and release are signed with different keys and can't replace each other
if ! "$ADB" install -r "$APK"; then
  echo "Install failed (signature mismatch?). Reinstalling — this wipes the app's data on the emulator."
  "$ADB" uninstall com.budgetapp || true
  "$ADB" install "$APK"
fi
"$ADB" shell pm grant com.budgetapp android.permission.RECEIVE_SMS || true
"$ADB" shell pm grant com.budgetapp android.permission.POST_NOTIFICATIONS || true
"$ADB" shell monkey -p com.budgetapp -c android.intent.category.LAUNCHER 1 >/dev/null
echo "App started. Send test SMS with: ./scripts/send_test_sms.sh"
