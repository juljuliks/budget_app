# 1.4.4–1.4.5: bank SMS already in the phone (the app didn't take them in: no RECEIVE_SMS while they came).
source "$(dirname "$0")/common/hook.sh"
[ "$1" = before ] || exit 0
clear_inbox
# import-denied leaves the SMS group (reading and receiving) denied for good: the system would not ask again
for p in READ_SMS RECEIVE_SMS; do $ADB shell pm clear-permission-flags "$PKG" android.permission.$p user-set user-fixed; done
$ADB shell pm revoke "$PKG" android.permission.RECEIVE_SMS
sms "11.00GEL\n(*1234)\nSPAR\n$(day 300) $(hm 300)"
sms "22.00GEL\n(*1234)\nCARREFOUR\n$(day 200) $(hm 200)"
sms "Money Transfer:\n33.00 GEL\nMC GOLD\n$(day 100)\nNINO B"
sms "Balance: 281.00GEL"
sms "Code: 195448 27.00 GEL payment at WOLT"
# a personal SMS: never read
sms "привет, как дела" "+995555123456"
sleep 5
[ "$(sql "SELECT count(*) FROM transactions WHERE sms_hash NOT LIKE 'manual:%'")" = 0 ] || { echo "the SMS were taken in live" >&2; exit 1; }
