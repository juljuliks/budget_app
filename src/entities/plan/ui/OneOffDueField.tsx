import React from 'react';
import { Text } from 'react-native';
import { Controller, UseFormReturn } from 'react-hook-form';
import { monthDays } from '@/shared/lib/dateRange';
import { dayTitle } from '@/shared/lib/dates';
import DateField from '@/shared/ui/DateField';
import { formStyles } from '@/shared/theme/formStyles';

export type DueForm = { due: string | null };

/**
 * A one-off payment's "Дата списания (необязательно)", a day of its month: it puts the payment on the stats' bar (paid or
 * not by that day), the month's pace counts it from that day.
 */
export function OneOffDueField({ ym, form }: { ym: string; form: UseFormReturn<DueForm> }) {
  const { from, to } = monthDays(ym);
  return (
    <>
      <Controller control={form.control} name="due" render={({ field }) => (
        <DateField
          label="Дата списания (необязательно)" value={field.value} format={dayTitle} sheetTitle="Дата списания" minDay={from} maxDay={to}
          onChange={field.onChange} onClear={() => field.onChange(null)}
        />
      )} />
      <Text style={formStyles.hint}>С датой платёж встанет на шкалу месяца в статистике.</Text>
    </>
  );
}
