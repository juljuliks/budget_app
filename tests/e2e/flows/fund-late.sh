# 6.5.12: a fund that can't make it by its date — said in the shade once the app starts (seed `fund-late`).
source "$(dirname "$0")/common/hook.sh"
if [ "$1" = before ]; then
  $ADB shell cmd statusbar collapse >/dev/null 2>&1 || true
  $ADB shell am start -n "$PKG/.MainActivity" >/dev/null
  notified "Одежда не успевает к [0-9]+ [а-я]+ 20[0-9]{2}" || { echo "no «не успевает» notification" >&2; exit 1; }
  notified "Копилке остаётся .* в месяц из .* — сдвиньте дату или сумму" || { echo "its text is not as expected" >&2; exit 1; }
  # the shade open for the flow (a swipe may not have it open yet when the tap comes: it lands on the app under it)
  $ADB shell cmd statusbar expand-notifications; sleep 2
fi
