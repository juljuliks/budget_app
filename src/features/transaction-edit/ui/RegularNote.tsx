import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RegularOfMonth, regularOfCategory, ymOf } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import { MONTHS_PREP, WEEKDAYS } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';
import { RepeatIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import type { Tx } from '../model/useTransaction';
import PaymentQuestion from './PaymentQuestion';

/**
 * An operation of a category with a regular payment within its month ("Каждый день", "Каждую неделю"): how often, each
 * time's amount, how many of the month's days its spending paid; another amount — "Это оплата?".
 */
export default function RegularNote({ tx }: { tx: Tx }) {
  const [r, setR] = useState<RegularOfMonth | null>(null);
  const d = new Date(tx.occurred_at * 1000);
  const ym = ymOf(d.getFullYear(), d.getMonth());
  useEffect(() => {
    let live = true;
    const run = () => {
      (tx.category_id === null ? Promise.resolve(null) : regularOfCategory(tx.category_id, ym))
        .then((x) => { if (live) setR(x); }).catch((e) => console.error('regular note failed', e));
    };
    run();
    const off = onTransactionsChanged(run);
    return () => { live = false; off(); };
  }, [tx.category_id, ym, tx.amount_minor]);
  if (!r) return null;
  const days = r.every === 'day' ? 'Каждый день'
    : [0, 1, 2, 3, 4, 5, 6].filter((i) => (r.weekdays & (1 << i)) !== 0).map((i) => WEEKDAYS[(i + 1) % 7]).join(', ');
  const month = `В ${MONTHS_PREP[d.getMonth()]}`;
  return (
    <>
    <View style={styles.box}>
      <View style={styles.head}>
        <RepeatIcon color={colors.accent} size={16} />
        <Text style={styles.title}>{`Регулярный платёж · ${days}`}</Text>
        <Text style={styles.amount}>{formatWithCurrency(r.unit_minor, r.currency)}</Text>
      </View>
      <View style={styles.fact}>
        <Text style={styles.factLabel}>{month}</Text>
        <Text style={styles.factValue}>
          {`оплачено ${r.paid} из ${r.times}`}
        </Text>
      </View>
    </View>
    {tx.category_id !== null ? (
      <PaymentQuestion tx={tx} categoryId={tx.category_id} name={tx.category_name ?? ''} amount={r.unit_minor} currency={r.currency} />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: colors.surface, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  amount: { fontSize: 15, fontWeight: '500', color: colors.text, fontVariant: ['tabular-nums'] },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  factLabel: { fontSize: 13, color: colors.muted },
  factValue: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
