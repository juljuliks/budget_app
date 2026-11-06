#!/usr/bin/env bash
# The release APK goes to the Desktop as the next budget-app-<version>.apk (for the phone), then is built again for
# the emulator (-PemulatorSms: it reads SMS from "TBC" too) and installed there (started if it isn't running), the
# app's data there kept.
# Usage: ./scripts/release.sh [version]   (e.g. 6.0 to set it explicitly; default: the Desktop's latest + 0.1)
set -euo pipefail
trap 'echo "Failed at line $LINENO: $BASH_COMMAND" >&2' ERR

DIR="$(cd "$(dirname "$0")" && pwd)"

# builds the release APK and copies it to the Desktop
"$DIR/apk_to_desktop.sh" "$@"

"$DIR/emulator.sh" release
