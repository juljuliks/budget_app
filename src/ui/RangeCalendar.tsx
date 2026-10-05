import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MONTHS } from './stats/months';
import { colors } from './theme';

import { DayKey, DayRange, dayKeyOf, parseDayKey } from './dateRange';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export type { DayRange } from './dateRange';
export { formatRange, rangeToUnix } from './dateRange';

type Props = {
  value: DayRange | null;
  /**
   * 1st tap: that single day. 2nd tap: range between the two days. 3rd tap starts over.
   */
  onChange: (r: DayRange) => void;
  /** one day only: every tap picks that day */
  single?: boolean;
  /** days after this one can't be picked (e.g. a transaction can't be in the future) */
  maxDay?: DayKey;
};

/** Month grid (Monday first) for picking a day or a period. */
export default function RangeCalendar({ value, onChange, single = false, maxDay }: Props) {
  const today = dayKeyOf(new Date());
  const initial = value ? parseDayKey(value.to) : new Date();
  const [month, setMonth] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  // waiting for the second tap of a range
  const [anchor, setAnchor] = useState<DayKey | null>(null);

  const cells = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday = 0
    const days = new Date(month.y, month.m + 1, 0).getDate();
    const out: Array<DayKey | null> = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(dayKeyOf(new Date(month.y, month.m, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  function tap(day: DayKey) {
    if (single) { onChange({ from: day, to: day }); return; }
    if (anchor === null) {
      setAnchor(day);
      onChange({ from: day, to: day });
    } else {
      onChange(day < anchor ? { from: day, to: anchor } : { from: anchor, to: day });
      setAnchor(null);
    }
  }

  const shift = (delta: number) => setMonth(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={12}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>{MONTHS[month.m]} {month.y}</Text>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={12}><Text style={styles.arrow}>›</Text></TouchableOpacity>
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((w) => <Text key={w} style={[styles.cell, styles.weekday]}>{w}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const inRange = value !== null && day >= value.from && day <= value.to;
            const isEdge = value !== null && (day === value.from || day === value.to);
            const off = maxDay !== undefined && day > maxDay;
            return (
              <TouchableOpacity key={day} style={[styles.cell, inRange && styles.inRange, isEdge && styles.edge]} onPress={() => tap(day)} disabled={off}>
                <Text style={[styles.day, day === today && styles.today, isEdge && styles.edgeText, off && styles.off]}>{Number(day.slice(8))}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {single ? null : <Text style={styles.hint}>
        {anchor ? 'Выберите конец периода или оставьте один день' : 'Нажмите день; второе нажатие — конец периода'}
      </Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 4 },
  arrow: { fontSize: 24, color: colors.accent, paddingHorizontal: 8 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row' },
  cell: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: 12, color: colors.muted, textAlign: 'center', textAlignVertical: 'center' },
  inRange: { backgroundColor: '#DBEAFE' },
  edge: { backgroundColor: colors.accent, borderRadius: 18 },
  day: { fontSize: 15, color: colors.text },
  today: { fontWeight: '700', color: colors.accent },
  edgeText: { color: '#FFFFFF', fontWeight: '600' },
  off: { color: colors.border },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 4 },
});
