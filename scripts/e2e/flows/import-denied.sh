# 1.4.2: SMS refused at the start (receiving too: reading comes with it otherwise).
source "$(dirname "$0")/common/hook.sh"
[ "$1" = before ] || exit 0
$ADB shell pm revoke "$PKG" android.permission.RECEIVE_SMS
