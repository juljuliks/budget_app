# 1.1, 1.3, 8.1 on the device: SMS arrive while the app is closed — the bank's are taken in by the background task (an
# operation, a notification), a phone number's and another sender's are never read.
source "$(dirname "$0")/common/hook.sh"
[ "$1" = before ] || exit 0
sms "12.00GEL\n(*1234)\nNEWSHOP\n$(day 2) $(hm 2)\nBalance: 283.14GEL"
sms "44.00GEL\n(*1234)\nSPAR\n$(day 1) $(hm 1)" "+995555123456"
sms "45.00GEL\n(*1234)\nSPAR\n$(day) $(hm)" "TBCX"
wait_for "SELECT count(*) FROM transactions" 1
notified "Покупка — 12\.00.₾" || { echo "no notification for the new operation" >&2; exit 1; }
sleep 3
[ "$(sql "SELECT count(*) FROM transactions")" = 1 ] || { echo "an SMS not from the bank was taken in" >&2; exit 1; }
