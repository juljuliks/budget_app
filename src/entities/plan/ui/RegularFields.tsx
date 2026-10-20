import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { timesInMonth } from '@/db/plans';
import { MONTHS_PREP, WEEKDAYS } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import Chip from '@/shared/ui/Chip';
import { formStyles } from '@/shared/theme/formStyles';
import CategoryPaymentFields, { CategoryPaymentForm } from './CategoryPaymentFields';
import RepeatField, { RepeatForm, UntilField } from './RepeatField';

/** How often: within the month (every day, on weekdays) or every month and rarer (`period` months). */
export type RegularEvery = 'day' | 'week' | 'month';
export type RegularForm = RepeatForm & { every: RegularEvery; period: number; weekdays: number; next: string | null };
const EVERY: Array<[RegularEvery, number, string]> = [
  ['day', 0, 'Каждый день'], ['week', 0, 'Каждую неделю'], ['month', 1, 'Каждый месяц'], ['month', 3, 'Раз в 3 месяца'],
  ['month', 6, 'Раз в полгода'], ['month', 12, 'Раз в год'],
];
// Monday first: bit i is WEEKDAYS[(i + 1) % 7]
const DAYS = [0, 1, 2, 3, 4, 5, 6];

type Props = { ym: string; categoryId: number; form: UseFormReturn<RegularForm & { value: string; currency: Currency }> };

/**
 * "Регулярный платёж" (a category without "Подписки"): how often — within the month (the weekdays, the times and the
 * sum, repeated, its end) or monthly and rarer (the next charge, its end). Only the plan: nothing is matched with operations.
 */
export default function RegularFields({ ym, categoryId, form }: Props) {
  const [every, period, weekdays, until, value, currency] = useWatch({
    control: form.control, name: ['every', 'period', 'weekdays', 'until', 'value', 'currency'],
  });
  const unit = parseAmountOrZero(value ?? '') ?? 0;
  const times = every === 'month' ? 0 : timesInMonth(ym, every, weekdays, until);
  const pickEvery = (e: RegularEvery, p: number) => {
    form.setValue('every', e, { shouldDirty: true });
    if (p) form.setValue('period', p, { shouldDirty: true });
  };
  return (
    <View>
      <Text style={formStyles.label}>Как часто</Text>
      <View style={styles.chips}>
        {EVERY.map(([e, p, label]) => (
          <Chip key={label} label={label} selected={every === e && (e !== 'month' || period === p)} onPress={() => pickEvery(e, p)} />
        ))}
      </View>
      {every === 'week' ? (
        <Controller control={form.control} name="weekdays" render={({ field }) => (
          <View style={[styles.chips, styles.days]}>
            {DAYS.map((i) => <Chip key={i} label={WEEKDAYS[(i + 1) % 7]} compact selected={(field.value & (1 << i)) !== 0} onPress={() => field.onChange(field.value ^ (1 << i))} />)}
          </View>
        )} />
      ) : null}
      {every !== 'month' ? (
        <>
          <Text style={formStyles.hint}>
            {times ? `${times} ${plural(times, ['раз', 'раза', 'раз'])} в ${MONTHS_PREP[Number(ym.slice(5)) - 1]}${unit ? ` — ${formatWithCurrency(unit * times, currency)}` : ''}` : 'Выберите дни недели'}
          </Text>
          <RepeatField ym={ym} form={form as unknown as UseFormReturn<RepeatForm>} entered={value ?? ''} currency={currency} regular />
          {/* the times in this month are counted up to it too */}
          <UntilField ym={ym} form={form as unknown as UseFormReturn<RepeatForm>} />
        </>
      ) : null}
      {every === 'month' ? <CategoryPaymentFields ym={ym} categoryId={categoryId} form={form as unknown as UseFormReturn<CategoryPaymentForm>} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  days: { marginTop: 12 },
});
