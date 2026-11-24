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
import SubRow from './SubRow';
import PaymentSheet from './PaymentSheet';

const monthsOf = (p: number) => (p > 0 ? p : p < 0 ? (-p * 12) / 52 : null);

function subAmountNote(amount_minor: number, currency: string, period: number): string | null {
  const months = monthsOf(period);
  if (!months) return null;
  const perMonth = amount_minor / months;
  return months >= 12
    ? `≈ ${formatWithCurrency(perMonth, currency)} в месяц`
    : `в месяц · ${formatWithCurrency(perMonth * 12, currency)} в год`;
}

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
      {data.subs.length ? <SectionBand title="Активные" /> : null}
      {data.subs.length ? (
        data.subs.map(({ sub, next }) => (
          <SubRow
            key={sub.id}
            name={sub.name}
            merchantKey={sub.merchant_key}
            note={{
              prefix: periodText(sub.period),
              text: next ? `следующее ${shortDay(next)}` : 'Задать дату',
              warn: !next,
            }}
            amount={formatWithCurrency(sub.amount_minor, sub.currency)}
            amountNote={subAmountNote(sub.amount_minor, sub.currency, sub.period) ?? undefined}
            onPress={() => setOpen(targetOf(sub))}
            accessibilityLabel={`${w.One}: ${sub.name}`}
          />
        ))
      ) : (
        <Text style={formStyles.hint}>
          {data.merchants.length ? `Пока ${w.none}: сделайте подпиской мерчанта ниже.` : `Пока ${w.none}.`}
        </Text>
      )}
      {data.merchants.length ? <SectionBand title="Мерчанты без подписки" /> : null}
      {data.merchants.map((m) => (
        <SubRow
          key={m.merchant_key}
          name={m.name}
          merchantKey={m.merchant_key}
          note={{ prefix: `последняя ${shortDay(m.day)}`, text: 'Сделать подпиской', warn: true }}
          amount={formatWithCurrency(m.amount_minor, m.currency)}
          onPress={() =>
            setOpen({
              category,
              merchant_key: m.merchant_key,
              name: m.name,
              amount_minor: m.amount_minor,
              currency: m.currency,
              period: 1,
              due: null,
              last_day: m.day,
            })
          }
          accessibilityLabel={`${w.One}: ${m.name}`}
        />
      ))}
      <PaymentSheet target={open} onClose={() => setOpen(null)} />
    </View>
  );
}
