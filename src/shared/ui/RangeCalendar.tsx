import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/theme';
import { DayKey, DayRange, dayKeyOf, parseDayKey } from '../lib/dateRange';
import { gridMonthOf, gridStyles, MonthHeader, monthWeeks, shiftGridMonth } from './MonthGrid';
import { font, space, weight } from '../theme/tokens';

export type { DayRange } from '../lib/dateRange';
export { formatRange, rangeToUnix } from '../lib/dateRange';

type Props = {
  value: DayRange | null;
  /**
   * 1st tap: that single day. 2nd tap: range between the two days. 3rd tap starts over.
   */
  onChange: (r: DayRange) => void;
  /** one day only: every tap picks that day (from = to) */
  single?: boolean;
  /** days after it can't be picked (greyed), e.g. today for an operation's date */
  maxDay?: DayKey;
  /** days before it can't be picked (greyed), e.g. next month for a fund's date; the calendar opens on it */
  minDay?: DayKey;
};

/** Month grid (Monday first) for picking a day or a period. */
export default function RangeCalendar({ value, onChange, single, maxDay, minDay }: Props) {
  const today = dayKeyOf(new Date());
  const initial = value ? parseDayKey(value.to) : minDay ? parseDayKey(minDay) : new Date();
  const [month, setMonth] = useState(gridMonthOf(initial));
  // waiting for the second tap of a range
  const [anchor, setAnchor] = useState<DayKey | null>(null);
  // dates cleared ("Сбросить даты"): the next tap starts a new range, not the end of the one begun before
  useEffect(() => {
    if (value === null) setAnchor(null);
  }, [value]);

  const weeks = useMemo(() => monthWeeks(month), [month]);

  function tap(day: DayKey) {
    if (single) {
      onChange({ from: day, to: day });
      return;
    }
    if (anchor === null) {
      setAnchor(day);
      onChange({ from: day, to: day });
    } else {
      onChange(day < anchor ? { from: day, to: anchor } : { from: anchor, to: day });
      setAnchor(null);
    }
  }

  return (
    <View style={styles.wrap}>
      <MonthHeader month={month} onShift={(delta) => setMonth((m) => shiftGridMonth(m, delta))} />
      {weeks.map((week, r) => (
        <View key={r} style={gridStyles.row}>
          {week.map((day, i) => {
            if (!day) return <View key={i} style={gridStyles.cell} />;
            const inRange = value !== null && day >= value.from && day <= value.to;
            const isEdge = value !== null && (day === value.from || day === value.to);
            const off = (maxDay !== undefined && day > maxDay) || (minDay !== undefined && day < minDay);
            return (
              <TouchableOpacity
                key={day}
                testID={`day-${day}`}
                style={[gridStyles.cell, inRange && styles.inRange, isEdge && styles.edge]}
                onPress={() => tap(day)}
                disabled={off}
              >
                <Text
                  style={[
                    gridStyles.day,
                    day === today && gridStyles.today,
                    isEdge && styles.edgeText,
                    off && gridStyles.off,
                  ]}
                >
                  {Number(day.slice(8))}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {single ? null : (
        <Text style={styles.hint}>
          {anchor ? 'Выберите конец периода или оставьте один день' : 'Нажмите день; второе нажатие — конец периода'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space[4] },
  inRange: { backgroundColor: '#DBEAFE' },
  edge: { backgroundColor: colors.accent, borderRadius: 18 },
  edgeText: { color: '#FFFFFF', fontWeight: weight.semibold },
  hint: { fontSize: font.caption, color: colors.muted, textAlign: 'center', marginTop: space[4] },
});
