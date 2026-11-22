# 8.2.4: «Итоги 2026» — scheduled for 1 January at 10:00 when the app starts; shown now by running its job (seed `planned`).
source "$(dirname "$0")/common/hook.sh"
if [ "$1" = before ]; then
  $ADB shell cmd statusbar collapse >/dev/null 2>&1 || true
  $ADB shell am start -n "$PKG/.MainActivity" >/dev/null
  # the notifications are scheduled after the start's first render
  for _ in $(seq 1 30); do
    grep -q "$PKG/androidx.work" <<<"$($ADB shell dumpsys jobscheduler)" && break
    sleep 1
  done
  sleep 3
  run_scheduled
  notified "Итоги $(date +%Y)" || { echo "no «Итоги года» notification" >&2; exit 1; }
  notified "Отложено [0-9].*₾ за год · [0-9]+% бюджета" || { echo "its text is not as expected" >&2; exit 1; }
  # the shade open for the flow (a swipe may not have it open yet when the tap comes: it lands on the app under it)
  $ADB shell cmd statusbar expand-notifications; sleep 2
fi
