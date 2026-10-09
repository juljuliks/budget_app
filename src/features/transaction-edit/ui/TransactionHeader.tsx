import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { formatAmount, formatDay, formatTime, isIncome, merchantLabel } from '@/shared/lib/format';
import { PencilIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import type { Tx } from '../model/useTransaction';

type Props = { tx: Tx; onEditAmount: () => void; onOpenMerchant?: () => void };

/** The amount (tap to correct it and its currency), the merchant (a link to its card when it has one), the date. */
export default function TransactionHeader({ tx, onEditAmount, onOpenMerchant }: Props) {
  return (
    <>
      <TouchableOpacity style={styles.amountRow} onPress={onEditAmount} accessibilityLabel="Изменить сумму">
        <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
          {formatAmount(tx.amount_minor, tx.currency, tx.kind)}
        </Text>
        <PencilIcon color={colors.accent} size={18} />
      </TouchableOpacity>
      {/* a merchant of purchases / payments: its name opens its card (its category, its operations) */}
      {onOpenMerchant ? (
        <TouchableOpacity onPress={onOpenMerchant} hitSlop={6} accessibilityRole="button" accessibilityHint="Открыть мерчанта">
          <Text style={[styles.merchant, styles.merchantLink]}>{merchantLabel(tx)} ›</Text>
        </TouchableOpacity>
      ) : <Text style={styles.merchant}>{merchantLabel(tx)}</Text>}
      <Text style={styles.meta}>{formatDay(tx.occurred_at)}, {formatTime(tx.occurred_at)}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  amount: { fontSize: 28, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  income: { color: colors.income },
  merchant: { fontSize: 18, color: colors.text, marginTop: 4 },
  merchantLink: { color: colors.accent },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
});
