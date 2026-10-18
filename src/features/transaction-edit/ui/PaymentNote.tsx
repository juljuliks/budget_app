import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCategory, isRecurring } from '@/db/categories';
import { paymentWords, PaymentWords } from '@/entities/category';
import { savePayment, paymentCard, PaymentCard } from '@/db/recurring';
import { emitTransactionsChanged, onTransactionsChanged } from '@/domain/events';
import { dayTitle } from '@/shared/lib/dates';
import { periodText, plural } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { openPayment } from '@/shared/navigation/sheets';
import { RepeatIcon } from '@/shared/ui/icons';
import { toast, toastFailure } from '@/shared/ui/toast';
import { colors } from '@/shared/theme/theme';
import type { Tx } from '../model/useTransaction';

/**
 * An operation in "Подписки": its merchant's repeating payment — how often, the next charge, this year's; "Изменить
 * подписку". No repeating payment or no day yet: "Задать дату". The last charge of another amount: "Обновить подписку?".
 */
export default function PaymentNote({ tx }: { tx: Tx }) {
  const [card, setCard] = useState<PaymentCard | null | 'none'>(null);
  const [w, setW] = useState<PaymentWords | null>(null);
  useEffect(() => {
    let live = true;
    const load = async () => {
      const c = tx.category_id === null ? undefined : await getCategory(tx.category_id);
      if (!tx.merchant_key || !c || !isRecurring(c)) return null;
      if (live) setW(paymentWords(c.name));
      return (await paymentCard(tx.merchant_key)) ?? 'none';
    };
    const run = () => load().then((c) => { if (live) setCard(c); }).catch((e) => console.error('payment card failed', e));
    run();
    const off = onTransactionsChanged(run);
    return () => { live = false; off(); };
  }, [tx.id, tx.merchant_key, tx.category_id, tx.amount_minor]);
  if (!card || !w) return null;
  if (card === 'none' || !card.sub.due) {
    return (
      <TouchableOpacity style={styles.box} onPress={() => openPayment({ txId: tx.id })} accessibilityRole="button">
        <Text style={styles.title}>{`${w.One} без даты списания`}</Text>
        <Text style={styles.link}>Задать дату ›</Text>
      </TouchableOpacity>
    );
  }
  const { sub } = card;
  const money = (minor: number) => formatWithCurrency(minor, sub.currency);
  // the latest charge is this one and its amount isn't the repeating payment's
  const changed = card.last?.id === tx.id && tx.currency === sub.currency && tx.amount_minor !== sub.amount_minor;
  const update = () => savePayment({ ...sub, amount_minor: tx.amount_minor }, sub.id)
    .then(() => { emitTransactionsChanged(); toast(`${sub.name} — ${money(tx.amount_minor)}`); })
    .catch(toastFailure('update payment', SAVE_FAILED));
  return (
    <>
      <View style={styles.box}>
        <View style={styles.head}>
          <RepeatIcon color={colors.accent} size={16} />
          <Text style={styles.title}>{`${sub.name} · ${periodText(sub.period_months)}`}</Text>
          <Text style={styles.amount}>{money(sub.amount_minor)}</Text>
        </View>
        {card.next ? <View style={styles.fact}><Text style={styles.factLabel}>Следующее списание</Text><Text style={styles.factValue}>{dayTitle(card.next)}</Text></View> : null}
        <View style={styles.fact}>
          <Text style={styles.factLabel}>В этом году списано</Text>
          <Text style={styles.factValue}>{`${card.year_count} ${plural(card.year_count, ['раз', 'раза', 'раз'])} · ${money(card.year_minor)}`}</Text>
        </View>
        <TouchableOpacity onPress={() => openPayment({ id: sub.id })} hitSlop={8} accessibilityRole="button">
          <Text style={styles.link}>{`Изменить ${w.acc} ›`}</Text>
        </TouchableOpacity>
      </View>
      {changed ? (
        <TouchableOpacity style={styles.warn} onPress={update} accessibilityRole="button">
          <Text style={styles.warnText}>
            {`Сумма ${tx.amount_minor > sub.amount_minor ? 'выросла' : 'уменьшилась'}: было ${money(sub.amount_minor)}. `}
            <Text style={styles.warnBold}>{`Обновить ${w.acc} на ${money(tx.amount_minor)}?`}</Text>
          </Text>
        </TouchableOpacity>
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
  link: { fontSize: 14, color: colors.accent },
  warn: { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: colors.warnBg },
  warnText: { fontSize: 14, color: colors.warn },
  warnBold: { fontWeight: '600' },
});
