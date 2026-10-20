import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecurringPayment } from '@/db/recurring';
import { SUBSCRIPTION_WORDS as w } from '@/entities/category';
import { currentYm } from '@/db/plans';
import { monthDays } from '@/shared/lib/dateRange';
import { formatWithCurrency } from '@/shared/lib/money';
import { pickPaymentOperation } from '@/shared/navigation/navigation';
import Button from '@/shared/ui/Button';
import SectionBand from '@/shared/ui/SectionBand';
import { formStyles } from '@/shared/theme/formStyles';
import { useCategorySubscriptions } from '../model/useCategorySubscriptions';
import type { PaymentCategory, PaymentTarget } from '../model/usePaymentForm';
import { periodText, shortDay } from '../texts';
import PaymentRow from './PaymentRow';
import PaymentSheet from './PaymentSheet';

/**
 * Under "Подписки" on a category's page: its subscriptions (how often, the next charge; a tap — its sheet), its merchants
 * without one ("Сделать подпиской": the day offered from the last charge), "＋ Добавить подписку" (an operation picked).
 */
export default function CategorySubscriptions({ category }: { category: PaymentCategory }) {
  const data = useCategorySubscriptions(category.id);
  const [open, setOpen] = useState<PaymentTarget | null>(null);
  const targetOf = (s: RecurringPayment): PaymentTarget => ({ ...s, category });
  if (!data) return null;
  const label = `${category.emoji ?? ''} ${category.name}`.trim();
  return (
    <View>
      {data.subs.length ? data.subs.map(({ sub, next }) => (
        <PaymentRow
          key={sub.id} label={w.One} name={sub.name} onPress={() => setOpen(targetOf(sub))}
          note={[periodText(sub.period), next ? `следующее ${shortDay(next)}` : 'Задать дату']} tone={next ? undefined : 'warn'}
          amount={formatWithCurrency(sub.amount_minor, sub.currency)}
        />
      )) : <Text style={formStyles.hint}>{`Пока ${w.none}: сделайте подпиской мерчанта ниже или выберите операцию.`}</Text>}
      {data.merchants.length ? <SectionBand title="Мерчанты без подписки" /> : null}
      {data.merchants.map((m) => (
        <PaymentRow
          key={m.merchant_key} label={w.One} name={m.name} note={[`последняя ${shortDay(m.day)}`, 'Сделать подпиской']} tone="warn"
          amount={formatWithCurrency(m.amount_minor, m.currency)}
          onPress={() => setOpen({ category, merchant_key: m.merchant_key, name: m.name, amount_minor: m.amount_minor, currency: m.currency, period: 1, due: null, last_day: m.day })}
        />
      ))}
      <Button title={`＋ ${w.add}`} outline style={styles.add}
        onPress={() => pickPaymentOperation({ id: category.id, label }, monthDays(currentYm()))} />
      <PaymentSheet target={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  add: { marginTop: 12, marginBottom: 8 },
});
