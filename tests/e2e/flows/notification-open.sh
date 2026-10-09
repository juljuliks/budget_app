# 8.1.6: tapping the notification opens the operation; the notification stays until a category is picked.
source "$(dirname "$0")/common/hook.sh"
if [ "$1" = before ]; then
  $ADB shell cmd statusbar collapse >/dev/null 2>&1 || true
  sms "12.00GEL\n(*1234)\nNEWSHOP\n$(day) $(hm)"
  notified "Покупка — 12\.00.₾" || { echo "no notification" >&2; exit 1; }
fi
