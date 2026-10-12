import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SPLIT_COLORS } from '@/entities/transaction';
import { chart } from '@/shared/theme/theme';

type Props = {
  /** the parts' amounts in their order (the own category first); one over the total is drawn red at the end */
  amounts: number[];
  total: number;
};

/** A split operation's parts as one bar, each in its color (SPLIT_COLORS); what's not given yet stays empty. */
export default function SplitBar({ amounts, total }: Props) {
  const sum = amounts.reduce((a, v) => a + v, 0);
  const over = sum > total;
  const scale = Math.max(sum, total) || 1;
  return (
    <View style={styles.bar}>
      {amounts.map((v, i) => (v > 0
        ? <View key={i} style={{ flex: v / scale, backgroundColor: over ? chart.critical : SPLIT_COLORS[i % SPLIT_COLORS.length] }} />
        : null))}
      {sum < total ? <View style={{ flex: (total - sum) / scale }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, backgroundColor: chart.meterTrack },
});
