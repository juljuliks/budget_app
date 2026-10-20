import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { categoryPayment, chargeBefore, offeredDue, paymentNext, todayKey } from '@/db/recurring';
import { dayTitle } from '@/shared/lib/dates';
import { toInputValue } from '@/shared/lib/money';
import DateField from '@/shared/ui/DateField';
import { formStyles } from '@/shared/theme/formStyles';
import { UntilField, RepeatForm } from './RepeatField';

/**
 * The category's own payment, monthly or rarer: the next charge (a monthly one may go without — the amount stands in each
 * month's plan), its end.
 */
export type CategoryPaymentForm = RepeatForm & { period: number; next: string | null; value: string; currency: Currency };

type Props = { ym: string; categoryId: number; form: UseFormReturn<CategoryPaymentForm> };

/**
 * "Регулярный платёж", "Каждый месяц" … "Раз в год": "Следующее списание" and "Дата окончания"; its saved payment comes back
 * (amount, how often, the next charge). Only the plan: each charge stands in its month, nothing is matched with operations.
 */
export default function CategoryPaymentFields({ ym, categoryId, form }: Props) {
  const [period, next] = useWatch({ control: form.control, name: ['period', 'next'] });
  // the charge another period is counted from (its payment's last one); a day picked by hand in this sheet stays
  const [anchor, setAnchor] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  useEffect(() => {
    (async () => {
      const own = await categoryPayment(categoryId);
      if (!own) return;
      const next = await paymentNext(own.id);
      form.reset({ ...form.getValues(), value: toInputValue(own.amount_minor), currency: own.currency, period: own.period, next, until: own.until });
      if (next) setAnchor(chargeBefore(next, own.period));
    })().catch((e) => console.error('category payment failed', e));
    // once per category
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);
  // another period: the day follows it, until picked by hand
  useEffect(() => {
    if (anchor && !byHand) form.setValue('next', offeredDue(anchor, period, todayKey()), { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, anchor]);
  return (
    <View>
      <Controller control={form.control} name="next" render={({ field }) => (
        <DateField
          label={period === 1 ? 'Следующее списание (необязательно)' : 'Следующее списание'} value={field.value} format={dayTitle}
          sheetTitle="Следующее списание" minDay={todayKey()}
          onChange={(day) => { setByHand(true); field.onChange(day); }}
          // a monthly one may go without: the amount stands in each month's plan
          onClear={period === 1 ? () => { setByHand(true); field.onChange(null); } : undefined}
        />
      )} />
      <Text style={formStyles.hint}>
        {next ? 'Каждое списание встанет в план своего месяца.'
          : period === 1 ? 'Без даты сумма стоит в плане каждый месяц.' : 'Выберите дату следующего списания.'}
      </Text>
      <UntilField ym={ym} form={form as unknown as UseFormReturn<RepeatForm>} />
    </View>
  );
}
