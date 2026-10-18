import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { lastCategoryDay, offeredDue, paymentCard, todayKey } from '@/db/recurring';
import { toInputValue } from '@/shared/lib/money';
import { dayTitle } from '@/shared/lib/dates';
import { PAYMENT_PERIODS } from '@/shared/lib/format';
import Chip from '@/shared/ui/Chip';
import DateField from '@/shared/ui/DateField';
import { formStyles } from '@/shared/theme/formStyles';

/** The plan sheet's repeating payment: how often and the next charge (none — the amount stands each month). */
export type RecurringForm = { period: number; next: string | null };

type Props = { categoryId: number; form: UseFormReturn<RecurringForm & { value: string; currency: Currency }> };

/**
 * "Повторяющийся платёж" in the plan's sheet: "Как часто" and "Следующее списание" — offered from the category's last
 * spending plus the period; for a monthly one it may stay empty ("необязательно"), a rarer one needs it.
 */
export default function RecurringFields({ categoryId, form }: Props) {
  const [period, next] = useWatch({ control: form.control, name: ['period', 'next'] });
  // its own payment (saved from here before): its amount, how often, the next charge; none — the day offered once: the
  // category's last spending plus the period, not in the past
  useEffect(() => {
    (async () => {
      const own = await paymentCard(null, undefined, categoryId);
      if (own && !own.sub.merchant_key) {
        form.reset({ ...form.getValues(), value: toInputValue(own.sub.amount_minor), currency: own.sub.currency, period: own.sub.period_months, next: own.next });
        return;
      }
      const day = await lastCategoryDay(categoryId);
      if (day && !form.getValues('next')) form.setValue('next', offeredDue(day, form.getValues('period') ?? 1, todayKey()), { shouldDirty: true });
    })().catch((e) => console.error('category payment failed', e));
    // once per category
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);
  return (
    <View>
      <Text style={formStyles.label}>Как часто</Text>
      <Controller control={form.control} name="period" render={({ field }) => (
        <View style={styles.chips}>
          {PAYMENT_PERIODS.map(([m, label]) => <Chip key={m} label={label} selected={field.value === m} onPress={() => field.onChange(m)} />)}
        </View>
      )} />
      <Controller control={form.control} name="next" render={({ field }) => (
        <DateField
          label={period === 1 ? 'Следующее списание (необязательно)' : 'Следующее списание'} value={field.value} format={dayTitle}
          sheetTitle="Следующее списание" minDay={todayKey()} onChange={field.onChange}
        />
      )} />
      <Text style={formStyles.hint}>
        {next ? 'Списание засчитывается тратой категории за 7 дней до или после даты — дата сдвинется сама.'
          : period === 1 ? 'Без даты сумма просто стоит в плане каждый месяц.' : 'Для платежа реже раза в месяц нужна дата.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
