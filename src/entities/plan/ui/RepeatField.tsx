import React from 'react';
import { StyleSheet } from 'react-native';
import { Controller, UseFormReturn } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { MONTHS_PREP } from '@/shared/lib/dates';
import { formatWithCurrency, parseAmountOrZero } from '@/shared/lib/money';
import SwitchRow from '@/shared/ui/SwitchRow';

export type RepeatForm = { pinned: boolean };

type Props = { ym: string; form: UseFormReturn<RepeatForm>; entered: string; currency: Currency };

/**
 * "Повторять каждый месяц" of a limit: on — the next month's plan has it with the same amount
 * (the badge on its icon in the plan), off — it carries over without one.
 */
export default function RepeatField({ ym, form, entered, currency }: Props) {
  const next = `В ${MONTHS_PREP[Number(ym.slice(5)) % 12]}`;
  const minor = parseAmountOrZero(entered) ?? 0;
  return (
    <Controller control={form.control} name="pinned" render={({ field }) => (
      <SwitchRow
        label="Повторять каждый месяц" on={field.value} onChange={field.onChange} style={styles.row}
        hint={field.value ? `${next} будет в плане с той же суммой${minor ? ` — ${formatWithCurrency(minor, currency)}` : ''}` : `${next} перейдёт без суммы`}
      />
    )} />
  );
}

// in the sheet's own padding: no inset of its own
const styles = StyleSheet.create({
  row: { paddingHorizontal: 0 },
});
