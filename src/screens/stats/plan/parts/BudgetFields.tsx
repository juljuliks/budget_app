import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Controller, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import { LockIcon } from '@/shared/ui/icons';
import Segmented from '@/shared/ui/Segmented';
import TextField from '@/shared/ui/TextField';
import StepSlider from '@/shared/ui/StepSlider';
import { useLoadedForm } from '@/shared/ui/form';
import { formStyles } from '@/shared/theme/formStyles';
import { BudgetForm, SHARE_STOPS } from '../model/budgetForm';
import { styles } from './styles';

/**
 * The part of the budget the plan can't take — "На траты вне плана": a % by the slider or an amount of one's own, or
 * "max" — all that is free (off with nothing free), switched by "% | USD | max". Kept in the form as an amount in the
 * budget's currency; can't take what is planned or 🔒.
 */
export function ShareField({
  form,
  planned,
  reserved,
  toShown,
  screen,
  title,
  icon,
  color,
  hint,
}: {
  form: ReturnType<typeof useLoadedForm<BudgetForm>>;
  /** what is planned (the funds, the month before's carry too), in the screen's currency */
  planned: number;
  /** 🔒 of the amount typed, in the budget's currency */
  reserved: number;
  toShown: (minor: number, from: Currency) => number | null;
  screen: Currency;
  title: string;
  /** 🔒 before the title */
  icon?: boolean;
  color: string;
  hint: (minor: number, currency: Currency) => string;
}) {
  const name = 'unplanned';
  const [value, cur, own] = useWatch({ control: form.control, name: ['value', 'currency', name] });
  const amount = parseAmountOrZero(value ?? '') ?? 0;
  const mine = parseAmountOrZero(own ?? '') ?? 0;
  // what is free for this part, in the budget's currency (the plan: screen → budget by the amount's own rate)
  const inScreen = cur === screen ? amount : (toShown(amount, cur) ?? amount);
  const plannedInBudget = inScreen > 0 ? Math.round((planned * amount) / inScreen) : planned;
  const room = Math.max(0, amount - plannedInBudget - reserved);
  const stopOf = (p: number) => Math.round((amount * p) / 100);
  const stop = amount > 0 ? SHARE_STOPS.find((p) => stopOf(p) === mine) : 0;
  const maxStop = amount > 0 ? (SHARE_STOPS.filter((p) => stopOf(p) <= room).pop() ?? 0) : 50;
  const set = (minor: number) => form.setValue(name, minor ? toInputValue(minor) : '', { shouldDirty: true });
  // an amount between the stops opens as an amount
  const [mode, setMode] = useState<'pct' | 'amount' | 'max'>(stop === undefined ? 'amount' : 'pct');
  // all that is free opens as "max" (once the form is loaded: the values come after the first render)
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !amount) return;
    opened.current = true;
    if (!(room > 0 && mine === room)) return;
    setMode('max');
  }, [amount, mine, room]);
  // "max": all that is free, following it (the budget or the other part changed); off with nothing free (or all of it in)
  useEffect(() => {
    if (mode === 'max' && mine !== room) set(room);
  }, [mode, mine, room]); // eslint-disable-line react-hooks/exhaustive-deps
  function switchMode(m: 'pct' | 'amount' | 'max') {
    if (m === 'max') set(room);
    // to the slider: the nearest stop that fits
    if (m === 'pct' && stop === undefined && amount > 0) {
      const near = SHARE_STOPS.reduce((b, p) => (Math.abs(stopOf(p) - mine) < Math.abs(stopOf(b) - mine) ? p : b), 0);
      set(stopOf(Math.min(near, maxStop)));
    }
    setMode(m);
  }
  return (
    <View style={styles.share}>
      <View style={styles.lockTitle}>
        {icon ? <LockIcon color={color} size={14} /> : null}
        <Text style={[formStyles.label, styles.lockLabel]}>{title}</Text>
        <Segmented
          options={
            [
              ['pct', '%'],
              ['amount', cur],
              ['max', 'MAX'],
            ] as const
          }
          value={mode}
          onChange={switchMode}
          style={styles.lockMode}
          disabled={(room <= 0 || room === mine) && mode !== 'max' ? ['max'] : []}
        />
      </View>
      {mode === 'pct' ? (
        <StepSlider
          values={SHARE_STOPS}
          value={stop ?? -1}
          onChange={(p) => set(stopOf(p))}
          max={maxStop}
          label={(v) => `${v}%`}
          color={color}
        />
      ) : (
        <Controller
          control={form.control}
          name={name}
          render={({ field }) => (
            <TextField
              style={styles.lockRow}
              amount
              compact
              value={field.value}
              // typed by hand: an amount of one's own, not "max" any more
              onChangeText={(t) => {
                field.onChange(t);
                if (mode === 'max') setMode('amount');
              }}
              placeholder="0"
              suffix={cur}
            />
          )}
        />
      )}
      <Text style={[formStyles.hint, mine > room && styles.overText]}>
        {mine > room
          ? `Не помещается: свободно ${formatWithCurrency(room, cur)} — остальное занято планом и отложенным.`
          : hint(mine, cur)}
      </Text>
    </View>
  );
}
