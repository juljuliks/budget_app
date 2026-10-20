import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { RecurringPayment } from '@/db/recurring';
import { SUBSCRIPTION_WORDS as w } from '@/entities/category';
import { formatWithCurrency } from '@/shared/lib/money';
import SectionBand from '@/shared/ui/SectionBand';
import { formStyles } from '@/shared/theme/formStyles';
import { useCategorySubscriptions } from '../model/useCategorySubscriptions';
import type { PaymentCategory, PaymentTarget } from '../model/usePaymentForm';
import { periodText, shortDay } from '../texts';
import PaymentRow from './PaymentRow';
import PaymentSheet from './PaymentSheet';

/**
 * Under "Подписки" on a category's page: its subscriptions (how often, the next charge; a tap — its sheet), its merchants
 * without one ("Сделать подпиской": the day offered from the last charge) — the one way a subscription is made.
 */
export default function CategorySubscriptions({ category }: { category: PaymentCategory }) {
  const data = useCategorySubscriptions(category.id);
  const [open, setOpen] = useState<PaymentTarget | null>(null);
  const targetOf = (s: RecurringPayment): PaymentTarget => ({ ...s, category });
  if (!data) return null;
  return (
    <View>
      {data.subs.length ? data.subs.map(({ sub, next }) => (
        <PaymentRow
          key={sub.id} label={w.One} name={sub.name} onPress={() => setOpen(targetOf(sub))}
          note={[periodText(sub.period), next ? `следующее ${shortDay(next)}` : 'Задать дату']} tone={next ? undefined : 'warn'}
          amount={formatWithCurrency(sub.amount_minor, sub.currency)}
        />
      )) : <Text style={formStyles.hint}>{data.merchants.length ? `Пока ${w.none}: сделайте подпиской мерчанта ниже.` : `Пока ${w.none}.`}</Text>}
      {data.merchants.length ? <SectionBand title="Мерчанты без подписки" /> : null}
      {data.merchants.map((m) => (
        <PaymentRow
          key={m.merchant_key} label={w.One} name={m.name} note={[`последняя ${shortDay(m.day)}`, 'Сделать подпиской']} tone="warn"
          amount={formatWithCurrency(m.amount_minor, m.currency)}
          onPress={() => setOpen({ category, merchant_key: m.merchant_key, name: m.name, amount_minor: m.amount_minor, currency: m.currency, period: 1, due: null, last_day: m.day })}
        />
      ))}
      <PaymentSheet target={open} onClose={() => setOpen(null)} />
    </View>
  );
}
