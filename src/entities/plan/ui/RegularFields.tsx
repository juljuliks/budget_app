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
import RepeatField, { RepeatForm, UntilField } from './RepeatField';

/** How often a regular payment is: within the month (every day, on weekdays) or every month and rarer (from an operation). */
export type RegularEvery = 'day' | 'week' | 'month';
export type RegularForm = RepeatForm & { every: RegularEvery; weekdays: number };

const EVERY: Array<[RegularEvery, string]> = [['day', 'Каждый день'], ['week', 'Каждую неделю'], ['month', 'Каждый месяц и реже']];
// Monday first: bit i is WEEKDAYS[(i + 1) % 7]
const DAYS = [0, 1, 2, 3, 4, 5, 6];

type Props = { ym: string; form: UseFormReturn<RegularForm & { value: string; currency: Currency }> };

/** The period chips of "Регулярный платёж"; within the month — the weekdays, the times and the sum, repeated, its end. */
export default function RegularFields({ ym, form }: Props) {
  const [every, weekdays, until, value, currency] = useWatch({ control: form.control, name: ['every', 'weekdays', 'until', 'value', 'currency'] });
  const unit = parseAmountOrZero(value ?? '') ?? 0;
  const times = every === 'month' ? 0 : timesInMonth(ym, every, weekdays, until);
  return (
    <View>
      <Controller control={form.control} name="every" render={({ field }) => (
        <View style={styles.chips}>
          {EVERY.map(([e, label]) => <Chip key={e} label={label} selected={field.value === e} onPress={() => field.onChange(e)} />)}
        </View>
      )} />
      {every === 'week' ? (
        <Controller control={form.control} name="weekdays" render={({ field }) => (
          <View style={[styles.chips, styles.days]}>
            {DAYS.map((i) => <Chip key={i} label={WEEKDAYS[(i + 1) % 7]} compact selected={(field.value & (1 << i)) !== 0} onPress={() => field.onChange(field.value ^ (1 << i))} />)}
          </View>
        )} />
      ) : null}
      {every === 'month' ? null : (
        <>
          <Text style={formStyles.hint}>
            {times ? `${times} ${plural(times, ['раз', 'раза', 'раз'])} в ${MONTHS_PREP[Number(ym.slice(5)) - 1]}${unit ? ` — ${formatWithCurrency(unit * times, currency)}` : ''}` : 'Выберите дни недели'}
          </Text>
          <RepeatField ym={ym} form={form as unknown as UseFormReturn<RepeatForm>} entered={value ?? ''} currency={currency} regular />
          {/* the times in this month are counted up to it too */}
          <UntilField ym={ym} form={form as unknown as UseFormReturn<RepeatForm>} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  days: { marginTop: 12 },
});
