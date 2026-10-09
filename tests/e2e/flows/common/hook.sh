# Helpers for the flows' scripts (flows/<flow>.sh, sourced): SMS to the emulator, the app's database, notifications.
set -euo pipefail
PKG=com.budgetapp
DB="$DIR/app.db"

# sms "<text>" [sender]: an SMS from the bank ("\n" in the text is a new line); the app takes it in the background
sms() { $ADB emu sms send "${2:-TBC}" "$1" >/dev/null; sleep 1; }

# sql "<query>": a query on the app's database on the emulator (adb root)
sql() { $ADB shell "sqlite3 -cmd '.timeout 5000' $DB \"$1\"" | tr -d '\r'; }

# clear_inbox: no SMS in the phone (the messages' own database, as root: the provider lets only the SMS app write)
clear_inbox() {
  $ADB shell "sqlite3 -cmd '.timeout 5000' /data/data/com.android.providers.telephony/databases/mmssms.db 'DELETE FROM sms; DELETE FROM threads;'"
}

# wait_for "<query>" "<expected>": until the query gives that (the SMS are taken in by a background task), at most 30 s
wait_for() {
  for _ in $(seq 1 30); do
    [ "$(sql "$1")" = "$2" ] && return 0
    sleep 1
  done
  echo "timed out: $1 → '$(sql "$1")', expected '$2'" >&2
  return 1
}

# notifications: the app's notification records only (from a "NotificationRecord(… pkg=com.budgetapp" line to the next
# record). Amounts have a no-break space before the currency: match it with "15\.00.₾".
app_notifications() {
  $ADB shell dumpsys notification --noredact | tr -d '\r' \
    | awk -v p="pkg=$PKG " '/NotificationRecord\(/ { on = index($0, p) > 0 } on'
}
# notified "<regex>": a notification of the app has this text, waiting for it up to 15 s
notified() {
  for _ in $(seq 1 15); do
    # the whole dump first: grep -q leaving early would fail the pipe (pipefail)
    grep -qE -- "$1" <<<"$(app_notifications)" && return 0
    sleep 1
  done
  return 1
}
# not_notified "<regex>": no notification of the app has it now
not_notified() { ! grep -qE -- "$1" <<<"$(app_notifications)"; }

# dd/mm/yyyy and hh:mm, minutes ago (default now)
day() { date -v-"${1:-0}"M +%d/%m/%Y; }
hm() { date -v-"${1:-0}"M +%H:%M; }
