import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';

/** "↩ Возвраты без категории +25 ₾": money back from merchants without a category (subtracted from the total). */
export default function RefundsRow({ amount, currency, onPress }: { amount: number; currency: Currency; onPress: () => void }) {
  if (amount <= 0) return null;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityHint="Показать возвраты без категории">
      <Text style={styles.label}>↩ Возвраты без категории</Text>
      <Text style={styles.amount}>+{formatWithCurrency(amount, currency)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingVertical: 10,
    borderTopWidth: 1, borderColor: colors.border,
  },
  label: { fontSize: 15, color: colors.muted },
  amount: { fontSize: 15, color: colors.income, fontVariant: ['tabular-nums'] },
});
