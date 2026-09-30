#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

echo "Building debug APK and installing to connected device..."

cd "$ANDROID_DIR"

if [ ! -f ./gradlew ]; then
  if command -v gradle >/dev/null 2>&1; then
    echo "Generating Gradle wrapper..."
    gradle wrapper
  else
    echo "Gradle not found. Install Gradle or open Android Studio to generate wrapper." >&2
    exit 1
  fi
fi

chmod +x ./gradlew

echo "Assembling debug APK..."
# Check for Java runtime
if ! command -v java >/dev/null 2>&1; then
  echo "Java runtime not found. Please install a JDK (e.g. OpenJDK 17)." >&2
  echo "On macOS you can: brew install openjdk@17 && sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk" >&2
  exit 1
fi

# Gradle 7.5 / RN 0.71 need JDK 17 (newer JDKs are not supported)
if /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
fi

./gradlew assembleDebug

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
  echo "APK not found at $APK_PATH" >&2
  exit 1
fi

echo "Installing APK..."
adb install -r "$APK_PATH"

echo "Granting runtime permissions (may fail on old Android versions)..."
adb shell pm grant com.budgetapp android.permission.RECEIVE_SMS || true
adb shell pm grant com.budgetapp android.permission.READ_SMS || true
adb shell pm grant com.budgetapp android.permission.POST_NOTIFICATIONS || true

echo "Done. To watch logs run: adb logcat | grep SmsBackgroundTask"
