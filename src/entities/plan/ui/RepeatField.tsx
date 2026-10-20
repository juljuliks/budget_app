import React from 'react';
import { StyleSheet } from 'react-native';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { dayTitle, MONTHS_PREP } from '@/shared/lib/dates';
import { formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import DateField from '@/shared/ui/DateField';
import SwitchRow from '@/shared/ui/SwitchRow';

export type RepeatForm = { pinned: boolean; until: string | null };

type Props = {
  ym: string; form: UseFormReturn<RepeatForm>; entered: string; currency: Currency;
};

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

/**
 * "Повторять каждый месяц" of a limit: on — the next month's plan has it with the same amount (the badge on its icon in
 * the plan) till "Дата окончания", off — it carries over without one.
 */
export default function RepeatField({ ym, form, entered, currency }: Props) {
  const next = `В ${MONTHS_PREP[Number(ym.slice(5)) % 12]}`;
  const minor = parseAmountOrZero(entered) ?? 0;
  const pinned = useWatch({ control: form.control, name: 'pinned' });
  const on = `${next} будет в плане с той же суммой${minor ? ` — ${formatWithCurrency(minor, currency)}` : ''}`;
  return (
    <>
      <Controller control={form.control} name="pinned" render={({ field }) => (
        <SwitchRow
          label="Повторять каждый месяц" on={field.value} onChange={field.onChange} style={styles.row}
          hint={field.value ? on : `${next} перейдёт без суммы`}
        />
      )} />
      {pinned ? <UntilField ym={ym} form={form} /> : null}
    </>
  );
}

// in the sheet's own padding: no inset of its own
const styles = StyleSheet.create({
  row: { paddingHorizontal: 0 },
});
