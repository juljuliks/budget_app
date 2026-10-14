# 9.11.10: the lock on with PIN 1234 before the app starts (run.sh turns it off after the flow).
source "$(dirname "$0")/common/hook.sh"
[ "$1" = before ] || exit 0
lock_on 1234
