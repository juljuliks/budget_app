import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { categoryPayment } from '@/db/recurring';
import { dayTitle } from '@/shared/lib/dates';
import { periodText } from '@/shared/lib/format';
import { toInputValue } from '@/shared/lib/money';
import DateField from '@/shared/ui/DateField';
import { formStyles } from '@/shared/theme/formStyles';
import { UntilField, RepeatForm } from './RepeatField';

/**
 * The category's own payment, monthly or rarer: its charge's day (`next`: the one the others are counted from, past this
 * month's too; a monthly one has none — the amount stands in each month's plan), its end.
 */
export type CategoryPaymentForm = RepeatForm & { period: number; next: string | null; value: string; currency: Currency };

type Props = { ym: string; categoryId: number; form: UseFormReturn<CategoryPaymentForm> };

/**
 * "Регулярный платёж", "Каждый месяц" … "Раз в год": "Дата списания" (rarer than monthly only) and "Дата окончания"; its saved payment comes back
 * (amount, how often, the day as it was put in). Only the plan: each charge stands in its month (none before the month it
 * was made in), nothing is matched with operations.
 */
export default function CategoryPaymentFields({ ym, categoryId, form }: Props) {
  const [period, next] = useWatch({ control: form.control, name: ['period', 'next'] });
  useEffect(() => {
    categoryPayment(categoryId).then((own) => {
      if (own) form.reset({ ...form.getValues(), value: toInputValue(own.amount_minor), currency: own.currency, period: own.period, next: own.due, until: own.until });
    }).catch((e) => console.error('category payment failed', e));
    // once per category
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);
  return (
    <View>
      {/* monthly: the amount in each month's plan, a day changes nothing */}
      {period === 1 ? null : (
        <Controller control={form.control} name="next" render={({ field }) => (
          <DateField label="Дата списания" value={field.value} format={dayTitle} sheetTitle="Дата списания" onChange={field.onChange} />
        )} />
      )}
      <Text style={formStyles.hint}>
        {period === 1 ? 'Сумма стоит в плане каждый месяц.'
          : next ? `Следующие — ${periodText(period)} от этой даты; списание встанет в план своего месяца.` : 'Выберите дату списания.'}
      </Text>
      <UntilField ym={ym} form={form as unknown as UseFormReturn<RepeatForm>} />
    </View>
  );
}
