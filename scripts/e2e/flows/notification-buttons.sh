# 8.1.5: a category from the notification's button, the app not opened.
source "$(dirname "$0")/common/hook.sh"
if [ "$1" = before ]; then
  $ADB shell cmd statusbar collapse >/dev/null 2>&1 || true
  sms "12.00GEL\n(*1234)\nNEWSHOP\n$(day) $(hm)"
  notified "Покупка — 12\.00.₾" || { echo "no notification" >&2; exit 1; }
fi
if [ "$1" = after ]; then
  sleep 2
  not_notified "NEWSHOP" || { echo "the notification stayed after a category was picked" >&2; exit 1; }
  $ADB shell cmd statusbar collapse >/dev/null 2>&1 || true
fi
