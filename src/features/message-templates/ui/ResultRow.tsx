import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ParsedTx } from '@/domain/types';
import { merchantLabel } from '@/entities/transaction';
import { formatAmount, formatDay, formatTime, isIncome } from '@/shared/lib/format';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';

/** When it happened: the date in the text, else when the message came. */
export const occurredOf = (p: ParsedTx, receivedAt: number) => (p.occurred_at ? Math.floor(new Date(p.occurred_at).getTime() / 1000) : receivedAt);

/** The operation a message gives, drawn as a row of the operations list: the merchant, "Без категории · day, time", the amount. */
export default function ResultRow({ parsed, receivedAt }: { parsed: ParsedTx; receivedAt: number }) {
  const at = occurredOf(parsed, receivedAt);
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>{merchantLabel({ kind: parsed.kind, raw_merchant: parsed.raw_merchant || null })}</Text>
        <View style={styles.meta}>
          <Text style={styles.badge}>{NO_CATEGORY}</Text>
          <Text style={styles.time}> · {formatDay(at)}, {formatTime(at)}</Text>
        </View>
      </View>
      <Text style={[styles.amount, isIncome(parsed.kind) && styles.income]}>{formatAmount(parsed.amount_minor, parsed.currency, parsed.kind)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  main: { flex: 1, marginRight: 12 },
  title: { fontSize: 16, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  badge: {
    fontSize: 12, color: colors.warn, backgroundColor: colors.warnBg,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
  },
  time: { fontSize: 13, color: colors.muted },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  income: { color: colors.income },
});
