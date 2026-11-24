import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { plural } from '@/shared/lib/format';
import type { DayKey } from '@/shared/lib/dateRange';
import { longDay } from '@/shared/lib/dates';
import { gridMonthKey, gridMonthOf, gridStyles, MonthHeader, monthWeeks, shiftGridMonth } from '@/shared/ui/MonthGrid';
import { chart, colors } from '@/shared/theme/theme';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { DayPurchase, firstMonth, Mark, monthTally } from '../model/impulseCalendarView';
import { BY_DAY, BY_DAY_HINT, MARK_LEGEND, NO_PURCHASES } from '../model/impulseTexts';
import ImpulseDayCard from './ImpulseDayCard';

const MAX_MARKS = 3;
const MARKS: Mark[] = ['impulsive', 'intentional', 'unanswered'];

function MarkDot({ mark }: { mark: Mark }) {
  return (
    <View
      style={[
        styles.dot,
        mark === 'impulsive' ? styles.impulsive : mark === 'intentional' ? styles.intentional : styles.unanswered,
      ]}
    />
  );
}

type Props = {
  days: Map<DayKey, DayPurchase[]>;
  today: DayKey;
  money: (minor: number) => string;
  /** one month only ('YYYY-MM': the month's report) — no arrows; none — the current one, back to the first purchase's */
  month?: string;
};

/**
 * «Покупки по дням»: a month of purchases (a category's «Динамика»; all the categories asked about — the month's report),
 * a mark under a day per purchase (impulsive, considered, no answer); the arrows go back to the month of the first one
 * (`month` given — that one only). A tap on a marked day — its purchases under the calendar.
 */
export default function ImpulseCalendar({ days, today, money, month: only }: Props) {
  const hidden = useHideAmounts();
  const start = only ?? today.slice(0, 7);
  const now = useMemo(
    () => gridMonthOf(new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1)),
    [start],
  );
  const [month, setMonth] = useState(now);
  const [picked, setPicked] = useState<DayKey | null>(null);
  const ym = gridMonthKey(month);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const { count, sum } = monthTally(days, ym);
  const subtitle =
    count === 0
      ? NO_PURCHASES
      : `${count} ${plural(count, ['покупка', 'покупки', 'покупок'])}${hidden ? '' : ` · ${money(sum)}`}`;
  const shift = (delta: number) => {
    setMonth((m) => shiftGridMonth(m, delta));
    setPicked(null);
  };
  const pickedList = picked ? days.get(picked) : undefined;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{BY_DAY}</Text>
      <View style={styles.calendar}>
        <MonthHeader
          month={month}
          onShift={shift}
          canPrev={!only && ym > firstMonth(days, today)}
          canNext={!only && ym < gridMonthKey(now)}
          subtitle={subtitle}
        />
        {weeks.map((week, r) => (
          <View key={r} style={gridStyles.row}>
            {week.map((day, i) => {
              if (!day) return <View key={i} style={[gridStyles.cell, styles.cell]} />;
              const list = days.get(day) ?? [];
              const sel = day === picked;
              return (
                <TouchableOpacity
                  key={day}
                  testID={`day-${day}`}
                  style={[gridStyles.cell, styles.cell]}
                  disabled={list.length === 0}
                  onPress={() => setPicked(sel ? null : day)}
                  accessibilityLabel={
                    list.length
                      ? `${longDay(day)}, ${list.length} ${plural(list.length, ['покупка', 'покупки', 'покупок'])}`
                      : undefined
                  }
                >
                  <View style={[styles.num, sel && styles.picked]}>
                    <Text
                      style={[
                        gridStyles.day,
                        day === today && gridStyles.today,
                        day > today && gridStyles.off,
                        sel && styles.pickedText,
                      ]}
                    >
                      {Number(day.slice(8))}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {list.slice(0, MAX_MARKS).map((p) => (
                      <MarkDot key={p.tx} mark={p.mark} />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={styles.legend}>
          {MARKS.map((m) => (
            <View key={m} style={styles.legendItem}>
              <MarkDot mark={m} />
              <Text style={styles.legendText}>{MARK_LEGEND[m]}</Text>
            </View>
          ))}
        </View>
      </View>
      {picked && pickedList ? (
        <ImpulseDayCard day={picked} purchases={pickedList} money={money} />
      ) : (
        <Text style={styles.point}>{BY_DAY_HINT}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { fontSize: 13, color: colors.muted },
  point: { fontSize: 14, color: colors.text, marginTop: 10, minHeight: 20 },
  calendar: { marginTop: 6 },
  cell: { height: 46, justifyContent: 'flex-start', paddingTop: 2 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  picked: { backgroundColor: colors.accent },
  pickedText: { color: colors.onAccent, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  impulsive: { backgroundColor: colors.impulse },
  intentional: { backgroundColor: chart.meterFill },
  unanswered: { borderWidth: 1.5, borderColor: colors.faint },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 12, color: colors.muted },
});
