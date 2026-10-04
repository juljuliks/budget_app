#!/usr/bin/env bash
# Builds the release APK and copies it to the Desktop as budget-app-<version>.apk.
# The version goes up from the latest one already on the Desktop: budget-app-5.8.apk -> budget-app-5.9.apk.
# Usage: ./scripts/apk_to_desktop.sh [version]   (e.g. 6.0 to set it explicitly)
set -euo pipefail
trap 'echo "Failed at line $LINENO: $BASH_COMMAND" >&2' ERR

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$HOME/Desktop"
APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk"

# Gradle 7.5 / RN 0.71 need JDK 17
if /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
fi

# without the release key the APK is signed with the debug one and won't update the app on the phone
if ! grep -q '^BUDGETAPP_RELEASE_STORE_FILE=' "$HOME/.gradle/gradle.properties" 2>/dev/null; then
  echo "Warning: BUDGETAPP_RELEASE_* not found in ~/.gradle/gradle.properties — the APK will be signed with the debug key." >&2
fi

if [ ! -d "$DESKTOP" ] || [ ! -w "$DESKTOP" ]; then
  echo "Can't write to $DESKTOP. On macOS: System Settings → Privacy & Security → Files and Folders → allow Desktop for your terminal." >&2
  exit 1
fi

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  # the highest budget-app-X.Y.apk already there; a glob, not ls: an unreadable folder must not stop the script silently
  LAST=""
  for f in "$DESKTOP"/budget-app-*.apk; do
    [ -e "$f" ] || continue
    v="${f##*/budget-app-}"; v="${v%.apk}"
    [[ "$v" =~ ^[0-9]+\.[0-9]+$ ]] || continue
    if [ -z "$LAST" ] || [ "$(printf '%s\n%s\n' "$LAST" "$v" | sort -t. -k1,1n -k2,2n | tail -1)" = "$v" ]; then LAST="$v"; fi
  done
  if [ -z "$LAST" ]; then
    VERSION="1.0"
  else
    VERSION="${LAST%.*}.$(( ${LAST#*.} + 1 ))"
  fi
fi
echo "Version: $VERSION"

echo "Building release APK..."
(cd "$ROOT_DIR/android" && ./gradlew assembleRelease -q)

OUT="$DESKTOP/budget-app-$VERSION.apk"
cp "$APK" "$OUT"
echo "Done: $OUT"
