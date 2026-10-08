# 1.1, 1.3, 8.1 on the device: SMS arrive while the app is closed — the bank's are taken in by the background task (an
# operation, a notification), a long one in several parts joined into one, a phone number's and another sender's never
# read.
source "$(dirname "$0")/common/hook.sh"
[ "$1" = before ] || exit 0
sms "12.00GEL\n(*1234)\nNEWSHOP\n$(day 2) $(hm 2)\nBalance: 283.14GEL"
# over 160 characters: the network delivers it in parts, the receiver joins them
sms "33.00GEL\n(*1234)\nLONGSHOP\n$(day 3) $(hm 3)\nBalance: 250.14GEL\nTBC Bank: your card was used for an online purchase. If it was not you, call +995322272727 or block the card in the TBC app right away."
sms "44.00GEL\n(*1234)\nSPAR\n$(day 1) $(hm 1)" "+995555123456"
sms "45.00GEL\n(*1234)\nSPAR\n$(day) $(hm)" "TBCX"
wait_for "SELECT count(*) FROM transactions" 2
notified "Покупка — 12\.00.₾" || { echo "no notification for the new operation" >&2; exit 1; }
sleep 3
[ "$(sql "SELECT count(*) FROM transactions")" = 2 ] || { echo "an SMS not from the bank was taken in" >&2; exit 1; }
