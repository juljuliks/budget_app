import React from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { dayTitle } from '@/shared/lib/dates';
import DateField from '@/shared/ui/DateField';

export type RepeatForm = { pinned: boolean; until: string | null };

/** "Дата окончания (необязательно)": repeated till that day (the months after don't have it). */
export function UntilField({ ym, form }: { ym: string; form: UseFormReturn<RepeatForm> }) {
  return (
    <Controller control={form.control} name="until" render={({ field }) => (
      <DateField
        label="Дата окончания (необязательно)" value={field.value} format={dayTitle} sheetTitle="Дата окончания" minDay={`${ym}-01`}
        onChange={field.onChange} onClear={() => field.onChange(null)}
      />
    )} />
  );
}
