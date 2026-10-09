import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';

type Props = {
  label: string;
  /** a chosen range: no arrows, a tap changes it */
  onPick?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** the arrow to the future: off once at today / the last month allowed */
  nextDisabled?: boolean;
  /** "месяц" or "период", for the arrows' labels */
  unit: 'месяц' | 'период';
};

/** "‹ Октябрь 2026 ›": the month or the period shown, with arrows to the previous / next one. */
export default function PeriodNav({ label, onPick, onPrev, onNext, nextDisabled, unit }: Props) {
  if (onPick) {
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.rangeButton} onPress={onPick}>
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const prev = unit === 'месяц' ? 'Предыдущий месяц' : 'Предыдущий период';
  const next = unit === 'месяц' ? 'Следующий месяц' : 'Следующий период';
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onPrev} hitSlop={12} accessibilityLabel={prev}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={onNext} hitSlop={12} disabled={nextDisabled} accessibilityLabel={next}>
        <Text style={[styles.arrow, nextDisabled && styles.arrowDisabled]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 8 },
  rangeButton: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  arrow: { fontSize: 28, color: colors.accent, paddingHorizontal: 8 },
  arrowDisabled: { color: colors.border },
  label: { fontSize: 17, fontWeight: '600', color: colors.text },
});
