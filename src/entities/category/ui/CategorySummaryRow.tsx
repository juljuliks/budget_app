import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import type { CategorySummary } from '../model/useCategoryForm';

/** Like a merchant's card: how many operations and how much spent; with some, a link to them. */
export default function CategorySummaryRow({ summary, onShow }: { summary: CategorySummary; onShow: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.meta} numberOfLines={1}>
        {summary.count} {plural(summary.count, ['операция', 'операции', 'операций'])}
        {summary.totals.length ? ` · ${summary.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ')}` : ''}
      </Text>
      {summary.count > 0 ? (
        <TouchableOpacity onPress={onShow} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Показать операции ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  meta: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  link: { fontSize: 14, color: colors.accent },
});
