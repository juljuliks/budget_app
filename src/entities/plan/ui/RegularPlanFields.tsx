import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useWatch, UseFormReturn } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { timesInMonth } from '@/db/plans';
import { longDay, MONTHS_PREP } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import type { RegularForm } from './RegularFields';
import { everyText, SCHEDULE_HINT } from './sheetOptions';

type Props = { ym: string; form: UseFormReturn<RegularForm & { value: string; currency: Currency }> };

/**
 * A regular payment every day, week or month in the plan's sheet: how often it is (its category's, «пн, чт · до 15 окт»),
 * within the month the times and their sum («9 раз в октябре — 180 ₾»); the amount is typed above.
 */
export default function RegularPlanFields({ ym, form }: Props) {
  const [every, weekdays, until, value, currency] = useWatch({ control: form.control, name: ['every', 'weekdays', 'until', 'value', 'currency'] });
  const unit = parseAmountOrZero(value ?? '') ?? 0;
  const times = every === 'month' ? 0 : timesInMonth(ym, every, weekdays, until);
  return (
    <View>
      <Text style={styles.schedule}>{`${everyText(every, weekdays)}${until ? ` · до ${longDay(until)}` : ''}`}</Text>
      {every !== 'month' ? (
        <Text style={formStyles.hint}>
          {`${times} ${plural(times, ['раз', 'раза', 'раз'])} в ${MONTHS_PREP[Number(ym.slice(5)) - 1]}${unit ? ` — ${formatWithCurrency(unit * times, currency)}` : ''}`}
        </Text>
      ) : null}
      <Text style={formStyles.hint}>{SCHEDULE_HINT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  schedule: { fontSize: 15, color: colors.text, marginBottom: 4 },
});
