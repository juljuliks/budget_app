import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { PeriodKind } from '@/shared/lib/dateRange';
import { openHistory } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';
import BottomSheet from '@/shared/ui/BottomSheet';

/** The stats' periods: the kind, its sheet's line, the header's words ("Статистика за месяц ▾"). */
export const PERIODS: Array<[PeriodKind, string, string]> = [
  ['day', 'За день', 'за день'],
  ['week', 'За неделю', 'за неделю'],
  ['month', 'За месяц', 'за месяц'],
  ['year', 'За год', 'за год'],
  // one day or several, picked in the calendar
  ['custom', 'Свой период', 'за период'],
];

type Props = { visible: boolean; kind: PeriodKind; onPick: (k: PeriodKind) => void; onClose: () => void };

/** The period list, as a sheet like every other choice; «История по месяцам ›» last. */
export default function PeriodSheet({ visible, kind, onPick, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Период">
      {PERIODS.map(([k, label]) => (
        <TouchableOpacity key={k} style={styles.menuItem} onPress={() => onPick(k)} accessibilityState={{ selected: k === kind }}>
          <Text style={[styles.menuText, k === kind && styles.menuSelected]}>{label}</Text>
          {k === kind ? <Text style={styles.menuCheck}>✓</Text> : null}
        </TouchableOpacity>
      ))}
      {/* plan and spending by months: not a period of these stats, a page of its own */}
      <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); openHistory(); }} accessibilityRole="button">
        <Text style={styles.menuText}>История по месяцам ›</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  menuText: { flex: 1, fontSize: 16, color: colors.text },
  menuSelected: { color: colors.accent, fontWeight: '600' },
  menuCheck: { fontSize: 16, color: colors.accent, marginLeft: 12 },
});
