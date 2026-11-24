import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { font, space, weight } from '@/shared/theme/tokens';

type Props = {
  label: string;
  /** a chosen range: no arrows, a tap changes it */
  onPick?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** the arrow to the future: off once at today / the last month allowed */
  nextDisabled?: boolean;
  /** the arrow to the past: off at the first one there is */
  prevDisabled?: boolean;
  /** "месяц", "год" or "период", for the arrows' labels */
  unit: 'месяц' | 'год' | 'период';
};

/** "‹ Октябрь 2026 ›": the month or the period shown, with arrows to the previous / next one. */
export default function PeriodNav({ label, onPick, onPrev, onNext, nextDisabled, prevDisabled, unit }: Props) {
  if (onPick) {
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.rangeButton} onPress={onPick}>
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const prev = unit === 'месяц' ? 'Предыдущий месяц' : unit === 'год' ? 'Предыдущий год' : 'Предыдущий период';
  const next = unit === 'месяц' ? 'Следующий месяц' : unit === 'год' ? 'Следующий год' : 'Следующий период';
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onPrev} hitSlop={12} disabled={prevDisabled} accessibilityLabel={prev}>
        <Text style={[styles.arrow, prevDisabled && styles.arrowDisabled]}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={onNext} hitSlop={12} disabled={nextDisabled} accessibilityLabel={next}>
        <Text style={[styles.arrow, nextDisabled && styles.arrowDisabled]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[24],
    marginBottom: space[8],
  },
  rangeButton: { flex: 1, alignItems: 'center', paddingVertical: space[6] },
  arrow: { fontSize: font.display, color: colors.accent, paddingHorizontal: space[8] },
  arrowDisabled: { color: colors.border },
  label: { fontSize: 17, fontWeight: weight.semibold, color: colors.text },
});
