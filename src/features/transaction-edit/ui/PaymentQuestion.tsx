import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { amountIn, matchesAmount, paymentAnswer } from '@/db/recurring';
import { onTransactionsChanged } from '@/domain/events';
import { formatWithCurrency } from '@/shared/lib/money';
import { splitParts } from '@/entities/transaction';
import { colors } from '@/shared/theme/theme';
import { answerPayment } from '../model/commands';
import type { Tx } from '../model/useTransaction';

type Props = {
  tx: Tx;
  categoryId: number;
  /** the payment's name ("Спорт"), its amount (a regular payment within the month: each time's) and currency */
  name: string;
  amount: number;
  currency: string;
};

/**
 * "Это оплата?" under an operation of a category whose spending is its payment ("Траты категории") when its amount isn't
 * the payment's (±3%): "Да, оплата" counts it (a part too), "Нет, другая трата" — not (over the plan: the category's
 * overspend). Answered — what was said, "Изменить".
 */
export default function PaymentQuestion({ tx, categoryId, name, amount, currency }: Props) {
  const [state, setState] = useState<{ minor: number | null; answer: number | null } | null>(null);
  useEffect(() => {
    let live = true;
    // a split one: its part in the category (the rest of it is other categories')
    const own = splitParts(tx)?.find((p) => p.category_id === categoryId)?.amount_minor ?? tx.amount_minor;
    const run = () => Promise.all([amountIn(own, tx.currency, currency, tx.occurred_at), paymentAnswer(tx.id, categoryId)])
      .then(([minor, answer]) => { if (live) setState({ minor, answer }); }).catch((e) => console.error('payment question failed', e));
    run();
    const off = onTransactionsChanged(run);
    return () => { live = false; off(); };
    // the parts come with the operation (its row): a change of them reloads it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.id, tx.amount_minor, tx.parts, tx.currency, tx.occurred_at, categoryId, currency]);
  if (!state || state.minor === null || matchesAmount(state.minor, amount)) return null;
  const answer = (v: boolean | null) => { answerPayment(tx.id, categoryId, v); };
  if (state.answer !== null) {
    return (
      <View style={styles.done}>
        <Text style={styles.doneText}>{state.answer ? `Оплата «${name}»` : `Не оплата «${name}» — трата категории`}</Text>
        <TouchableOpacity onPress={() => answer(null)} hitSlop={8} accessibilityRole="button"><Text style={styles.link}>Изменить</Text></TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.warn}>
      <Text style={styles.warnText}>
        {`${formatWithCurrency(state.minor, currency)} — не сумма платежа «${name}» (${formatWithCurrency(amount, currency)}). `}
        <Text style={styles.warnBold}>Это оплата?</Text>
      </Text>
      <View style={styles.buttons}>
        <TouchableOpacity onPress={() => answer(true)} hitSlop={8} accessibilityRole="button"><Text style={styles.link}>Да, оплата</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => answer(false)} hitSlop={8} accessibilityRole="button"><Text style={styles.link}>Нет, другая трата</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warn: { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: colors.warnBg, gap: 8 },
  warnText: { fontSize: 14, color: colors.warn },
  warnBold: { fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 20 },
  done: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  doneText: { flex: 1, fontSize: 13, color: colors.muted },
  link: { fontSize: 14, color: colors.accent },
});
