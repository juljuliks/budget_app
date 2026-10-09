# 1.4.3: allowed, but no bank SMS in the phone.
source "$(dirname "$0")/common/hook.sh"
[ "$1" = before ] || exit 0
clear_inbox
$ADB shell pm grant "$PKG" android.permission.READ_SMS
