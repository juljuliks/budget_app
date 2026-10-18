import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import type { CategorySummary } from '../model/useCategoryForm';

/** Like a merchant's page: how many operations and how much spent — a link to them. */
export default function CategorySummaryRow({ summary, onShow }: { summary: CategorySummary; onShow: () => void }) {
  if (!summary.count) return <Text style={styles.none}>Операций нет</Text>;
  const totals = summary.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');
  return (
    <TextLink
      label={`${summary.count} ${plural(summary.count, ['операция', 'операции', 'операций'])}${totals ? ` · ${totals}` : ''}`}
      onPress={onShow} style={styles.link} containerStyle={styles.box}
    />
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  link: { fontSize: 15 },
  none: { fontSize: 15, color: colors.muted },
});
