import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DayKey, dayKeyOf } from '../lib/dateRange';
import { MONTHS } from '../lib/dates';
import { colors } from '../theme/theme';
import { font, space, weight } from '../theme/tokens';

/** A calendar's month: its year and month (0-based). */
export type GridMonth = { y: number; m: number };

const HEADS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const gridMonthOf = (d: Date): GridMonth => ({ y: d.getFullYear(), m: d.getMonth() });
export const gridMonthKey = ({ y, m }: GridMonth) => `${y}-${String(m + 1).padStart(2, '0')}`;

export function shiftGridMonth({ y, m }: GridMonth, delta: number): GridMonth {
  return gridMonthOf(new Date(y, m + delta, 1));
}

/** The month's days in weeks of 7 (Monday first), null in the blanks before the 1st and after the last day. */
export function monthWeeks({ y, m }: GridMonth): Array<Array<DayKey | null>> {
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday = 0
  const days = new Date(y, m + 1, 0).getDate();
  const out: Array<DayKey | null> = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) out.push(dayKeyOf(new Date(y, m, d)));
  while (out.length % 7) out.push(null);
  return Array.from({ length: out.length / 7 }, (_, r) => out.slice(r * 7, r * 7 + 7));
}

type HeaderProps = {
  month: GridMonth;
  onShift: (delta: number) => void;
  /** an arrow past the months there is anything in is greyed */
  canPrev?: boolean;
  canNext?: boolean;
  /** under the title: «6 покупок · 436 ₾» */
  subtitle?: React.ReactNode;
};

/** "‹ Ноябрь 2026 ›" and the weekdays' row over a month's grid. */
export function MonthHeader({ month, onShift, canPrev = true, canNext = true, subtitle }: HeaderProps) {
  const arrow = (delta: number, can: boolean, label: string) => (
    <TouchableOpacity
      onPress={() => onShift(delta)}
      disabled={!can}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.arrow, !can && styles.arrowOff]}>{delta < 0 ? '‹' : '›'}</Text>
    </TouchableOpacity>
  );
  return (
    <>
      <View style={styles.header}>
        {arrow(-1, canPrev, 'Прошлый месяц')}
        <View style={styles.titles}>
          <Text style={styles.title}>
            {MONTHS[month.m]} {month.y}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {arrow(1, canNext, 'Следующий месяц')}
      </View>
      <View style={gridStyles.row}>
        {HEADS.map((w) => (
          <Text key={w} style={[gridStyles.cell, styles.weekday]}>
            {w}
          </Text>
        ))}
      </View>
    </>
  );
}

export const gridStyles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: font.body, color: colors.text },
  today: { fontWeight: weight.bold, color: colors.accent },
  off: { color: colors.border },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[8],
    marginBottom: space[4],
  },
  titles: { alignItems: 'center' },
  arrow: { fontSize: font.headline, color: colors.accent, paddingHorizontal: space[8] },
  arrowOff: { color: colors.border },
  title: { fontSize: font.body, fontWeight: weight.semibold, color: colors.text },
  subtitle: { fontSize: font.caption, color: colors.muted, marginTop: space[2] },
  weekday: { fontSize: font.caption, color: colors.muted, textAlign: 'center', textAlignVertical: 'center' },
});
