#!/usr/bin/env bash
# Sends a fake TBC SMS to the running emulator (never to a USB phone).
# Usage:
#   ./scripts/send_test_sms.sh                  # a purchase
#   ./scripts/send_test_sms.sh transfer         # a money transfer
#   ./scripts/send_test_sms.sh custom "line1\nline2"
# The emulator console only accepts a sender without spaces, so "TBC" is used instead of "TBC SMS";
# both pass SmsReceiver's filter. Lines are separated with a literal \n.
set -euo pipefail

ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
SERIAL="$("$ADB" devices | awk '/^emulator-.*device$/{print $1; exit}')"
if [ -z "$SERIAL" ]; then
  echo "No running emulator. Start it with ./scripts/emulator.sh" >&2
  exit 1
fi

NOW_DATE="$(date +%d/%m/%y)"
NOW_TIME="$(date +%H:%M)"
AMOUNT="$(( RANDOM % 9000 + 100 ))"
AMOUNT="$((AMOUNT / 100)).$(printf '%02d' $((AMOUNT % 100)))"

case "${1:-purchase}" in
  purchase) TEXT="${AMOUNT}GEL\n(*XXXX)\nSPAR\nBalance: 100.00GEL\n${NOW_DATE} ${NOW_TIME}" ;;
  transfer) TEXT="Money Transfer:\n${AMOUNT} GEL\nMC GOLD\n$(date +%d/%m/%Y)" ;;
  custom)   TEXT="${2:?text required}" ;;
  *) echo "unknown kind: $1" >&2; exit 2 ;;
esac

"$ADB" -s "$SERIAL" emu sms send TBC "$TEXT"
echo "Sent to $SERIAL: $TEXT"
