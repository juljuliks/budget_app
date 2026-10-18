import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { txCategoryLabel } from '@/db/categories';
import type { TransactionRow } from '@/db/transactions';
import { formatAmount, formatDay, formatTime, isIncome } from '@/shared/lib/format';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { openTransaction } from '@/shared/navigation/navigation';
import SectionBand from '@/shared/ui/SectionBand';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import { rowTitle } from '../model/title';
import { RECENT_COUNT } from '../model/useRecentOperations';

type Props = {
  rows: TransactionRow[];
  /** all of them: more than shown — "Показать все ›" */
  count: number;
  /** whose page: a merchant's rows say the day and the category, a category's — the merchant and the day */
  of: 'merchant' | 'category';
  onShowAll: () => void;
};

/**
 * "Последние операции" of a merchant's or a category's page: a grey band ("Показать все ›" at its right when there are
 * more), the latest ones, newest first; a tap opens the operation's page.
 */
export default function RecentOperations({ rows, count, of, onShowAll }: Props) {
  if (!rows.length) return null;
  return (
    <View>
      <SectionBand
        title="Последние операции" inset={20}
        right={count > RECENT_COUNT ? <TextLink label="Показать все" onPress={onShowAll} style={styles.all} /> : null}
      />
      {rows.map((tx) => {
        const when = `${formatDay(tx.occurred_at)}, ${formatTime(tx.occurred_at)}`;
        const title = of === 'merchant' ? formatDay(tx.occurred_at) : rowTitle(tx);
        const meta = of === 'merchant' ? `${txCategoryLabel(tx) ?? NO_CATEGORY} · ${formatTime(tx.occurred_at)}` : when;
        return (
          <TouchableOpacity key={tx.id} style={styles.row} onPress={() => openTransaction(tx.id)} accessibilityRole="button">
            <View style={styles.main}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
            </View>
            <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>{formatAmount(tx.amount_minor, tx.currency, tx.kind)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// as the operations list's rows (TransactionItem)
const styles = StyleSheet.create({
  all: { fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  income: { color: colors.income },
});
