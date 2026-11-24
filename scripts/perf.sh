#!/usr/bin/env bash
# Times the app on the emulator (REFACTOR_PLAN.md D4): a cold start until «Операции» shows its rows, and a tap on
# «Статистика» until the month's stats show — by the marks the release build writes to logcat (usePerfMark:
# "perf:<name>:<ms>", the device's clock). The demo database (scripts/demo) in place of the app's, as for the docs;
# the app's own data on the emulator is replaced. Install a release build first (npm run emulator).
# Usage: scripts/perf.sh [RUNS=5] [OUT]   — the medians (ms) to stdout and, with OUT, to that file
set -euo pipefail
cd "$(dirname "$0")/.."
RUNS="${1:-5}"; OUT="${2:-}"
A="adb -s emulator-5554"; PKG=com.budgetapp; DIR=/data/data/$PKG/files
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# the demo database, as scripts/demo/docs.sh loads it
rm -rf dist-demo
npx tsc -p scripts/demo
node dist-demo/scripts/demo/demoDb.js "$TMP/demo.db"
$A root >/dev/null; sleep 2; $A wait-for-device
$A shell am force-stop $PKG
owner="$($A shell stat -c %u:%g /data/data/$PKG | tr -d '\r')"
$A shell rm -f $DIR/app.db $DIR/app.db-wal $DIR/app.db-shm
$A push "$TMP/demo.db" $DIR/app.db >/dev/null
$A shell chown "$owner" $DIR/app.db; $A shell chmod 660 $DIR/app.db; $A shell restorecon $DIR/app.db || true
# the first start migrates the demo database: not timed
$A shell am start -n $PKG/.MainActivity >/dev/null; sleep 8

# runs a command on the device and prints the device's time right before it (no adb round trip in between)
at() { $A shell "date +%s%3N; $1 >/dev/null" | tr -d '\r'; }
# waits (up to 30 s) for the mark and prints its time
mark() {
  local name="$1" line
  for _ in $(seq 150); do
    line="$($A logcat -d -s ReactNativeJS:I | grep -o "perf:$name:[0-9]*" | tail -1 || true)"
    if [ -n "$line" ]; then echo "${line##*:}"; return; fi
    sleep 0.2
  done
  echo "no perf:$name mark in 30 s (a release build with usePerfMark?)" >&2; exit 1
}
# the centre of the bottom tab «Статистика», from the screen's layout
tab_xy() {
  $A shell uiautomator dump /sdcard/perf.xml >/dev/null
  $A shell cat /sdcard/perf.xml | tr '>' '\n' | grep -m1 -E '(text|content-desc)="Статистика' \
    | sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/' \
    | awk '{ print int(($1 + $3) / 2), int(($2 + $4) / 2) }'
}
median() { sort -n | awk '{ a[NR] = $1 } END { print (NR % 2 ? a[(NR + 1) / 2] : int((a[NR / 2] + a[NR / 2 + 1]) / 2)) }'; }

# one run untimed: the system settles after an install; the tab's place is read here, not right before a timed tap
run() {
  $A shell am force-stop $PKG; sleep 2
  $A logcat -c
  t0="$(at "am start -n $PKG/.MainActivity")"
  t1="$(mark operations)"
  sleep 3
  t2="$(at "input tap $x $y")"
  t3="$(mark stats)"
}
$A shell am force-stop $PKG; sleep 2
$A shell am start -n $PKG/.MainActivity >/dev/null; sleep 6
read -r x y < <(tab_xy)
run

: > "$TMP/start"; : > "$TMP/stats"
for i in $(seq "$RUNS"); do
  run
  echo $((t1 - t0)) >> "$TMP/start"
  echo $((t3 - t2)) >> "$TMP/stats"
  echo "run $i: start $((t1 - t0)) ms, «Статистика» $((t3 - t2)) ms" >&2
done

result="$(printf 'start\t%s\nstats\t%s\n' "$(median < "$TMP/start")" "$(median < "$TMP/stats")")"
echo "$result"
if [ -n "$OUT" ]; then
  { echo "# scripts/perf.sh, release on emulator-5554, the demo database: medians of $RUNS runs, ms ($(date +%F))"; echo "$result"; } > "$OUT"
fi
