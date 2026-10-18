import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { fundContribution, monthsBetween, parseYm } from '@/db/plans';
import { monthsTo } from '../model/fundTexts';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { dayTitle } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { currencySymbol, formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import DateField from '@/shared/ui/DateField';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';

/** The plan sheet's form, as far as a fund needs it: the target is the sheet's amount. */
export type FundForm = { value: string; currency: Currency; due: string | null; start: string };

type Props = { ym: string; categoryId: number; form: UseFormReturn<FundForm> };

/**
 * A fund's fields under the plan sheet's amount ("Накопить"): by when, what is saved already, and the month's contribution
 * they make. No date yet: "Выберите дату — посчитаем взнос в месяц" (the sheet can't be saved).
 */
export default function FundFields({ ym, categoryId, form }: Props) {
  const [value, currency, due, start] = useWatch({ control: form.control, name: ['value', 'currency', 'due', 'start'] });
  const [contribution, setContribution] = useState<number | null>(null);
  const target = parseAmountOrZero(value ?? '') ?? 0;
  const saved = parseAmountOrZero(start ?? '') ?? 0;
  const { year, month } = parseYm(ym);
  // the earliest date: the next month (this one's contribution alone can't make it)
  const minDay = dayKeyOf(new Date(year, month + 1, 1));
  const months = due ? monthsBetween(ym, due.slice(0, 7)) : 0;

  useEffect(() => {
    if (!due || !target) { setContribution(null); return undefined; }
    let live = true;
    fundContribution(ym, categoryId, { target_minor: target, currency, due, start_minor: saved })
      .then((c) => { if (live) setContribution(c); })
      .catch((e) => console.error('fund contribution failed', e));
    return () => { live = false; };
  }, [ym, categoryId, target, currency, due, saved]);

  return (
    <>
      <DateField
        label="К какой дате" value={due} format={dayTitle} suffix={due && months ? ` · ${monthsTo(months)}` : null}
        sheetTitle="К какой дате накопить" minDay={minDay} onChange={(d) => form.setValue('due', d, { shouldDirty: true })}
      />

      <Text style={formStyles.label}>Уже отложено (необязательно)</Text>
      <View style={[formStyles.input, styles.amountRow]}>
        <Controller control={form.control} name="start" render={({ field }) => (
          <TextInput
            style={styles.amountInput} value={field.value} onChangeText={field.onChange} placeholder="0.00"
            placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={12} accessibilityLabel="Уже отложено"
          />
        )} />
        <Text style={styles.muted}>{currencySymbol(currency)}</Text>
      </View>

      <View style={[styles.plate, due ? styles.plateOn : null]}>
        {due && contribution !== null ? (
          <>
            <Text style={styles.plateTitle}>{`${formatWithCurrency(contribution, currency)} в месяц · ${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])}`}</Text>
            <Text style={styles.plateText}>Взнос — часть бюджета месяца, как план категории. Месяц без плана — без взноса, следующие станут больше.</Text>
          </>
        ) : <Text style={[styles.plateTitle, styles.muted]}>{due ? 'Введите, сколько накопить' : 'Выберите дату — посчитаем взнос в месяц'}</Text>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 14 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  amountInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 10 },
  plate: { marginTop: 14, borderRadius: 10, padding: 12, backgroundColor: colors.surface, gap: 4 },
  plateOn: { backgroundColor: colors.fundBg },
  plateTitle: { fontSize: 16, fontWeight: '600', color: colors.fundText },
  plateText: { fontSize: 13, color: colors.muted },
});
