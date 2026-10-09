import React, { useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { Controller, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import { LockIcon } from '@/shared/ui/icons';
import Segmented from '@/shared/ui/Segmented';
import StepSlider from '@/shared/ui/StepSlider';
import { useLoadedForm } from '@/shared/ui/form';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { BudgetForm, SHARE_STOPS } from '../model/budgetForm';
import { RING_SAVINGS } from './palette';
import { styles } from './styles';

/**
 * A part of the budget the plan can't take — "🔒 Отложить сразу", "На траты вне плана": a % by the slider or an
 * amount of one's own, switched by "% | USD". Kept in the form as an amount in the budget's currency; can't take what is
 * planned or the other part.
 */
export function ShareField({ form, name, other, planned, toShown, screen, title, icon, color, hint }: {
  form: ReturnType<typeof useLoadedForm<BudgetForm>>;
  name: 'locked' | 'unplanned';
  other: 'locked' | 'unplanned';
  /** what is planned, in the screen's currency */
  planned: number;
  toShown: (minor: number, from: Currency) => number | null;
  screen: Currency;
  title: string;
  /** 🔒 before the title */
  icon?: boolean;
  color: string;
  hint: (minor: number, currency: Currency) => string;
}) {
  const [value, cur, own, otherText] = useWatch({ control: form.control, name: ['value', 'currency', name, other] });
  const amount = parseAmountOrZero(value ?? '') ?? 0;
  const mine = parseAmountOrZero(own ?? '') ?? 0;
  // what is free for this part, in the budget's currency (the plan: screen → budget by the amount's own rate)
  const inScreen = cur === screen ? amount : toShown(amount, cur) ?? amount;
  const plannedInBudget = inScreen > 0 ? Math.round((planned * amount) / inScreen) : planned;
  const room = Math.max(0, amount - plannedInBudget - (parseAmountOrZero(otherText ?? '') ?? 0));
  const stopOf = (p: number) => Math.round((amount * p) / 100);
  const stop = amount > 0 ? SHARE_STOPS.find((p) => stopOf(p) === mine) : 0;
  const maxStop = amount > 0 ? SHARE_STOPS.filter((p) => stopOf(p) <= room).pop() ?? 0 : 50;
  const set = (minor: number) => form.setValue(name, minor ? toInputValue(minor) : '', { shouldDirty: true });
  // an amount between the stops opens as an amount
  const [mode, setMode] = useState<'pct' | 'amount'>(stop === undefined ? 'amount' : 'pct');
  function switchMode(m: 'pct' | 'amount') {
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
        <Segmented options={[['pct', '%'], ['amount', cur]] as const} value={mode} onChange={switchMode} style={styles.lockMode} />
      </View>
      {mode === 'pct' ? (
        <StepSlider values={SHARE_STOPS} value={stop ?? -1} onChange={(p) => set(stopOf(p))} max={maxStop} label={(v) => `${v}%`} color={color} />
      ) : (
        <View style={styles.lockRow}>
          <Controller
            control={form.control}
            name={name}
            render={({ field }) => (
              <TextInput
                style={[formStyles.input, styles.lockInput]}
                value={field.value}
                onChangeText={field.onChange}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                maxLength={12}
              />
            )}
          />
          <Text style={styles.lockOwn}>{cur}</Text>
        </View>
      )}
      <Text style={[formStyles.hint, mine > room && styles.overText]}>
        {mine > room
          ? `Не помещается: свободно ${formatWithCurrency(room, cur)} — остальное занято планом${other === 'locked' ? ' и отложенным' : ' и долей вне плана'}.`
          : hint(mine, cur)}
      </Text>
    </View>
  );
}

/** "Что останется — в сбережения": the budget sheet's switch, remembered for the next months. */
export function SavingsSwitch({ form }: { form: ReturnType<typeof useLoadedForm<BudgetForm>> }) {
  return (
    <View style={styles.share}>
      <Controller
        control={form.control}
        name="toSavings"
        render={({ field }) => (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Что останется — в сбережения</Text>
            <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: RING_SAVINGS, false: colors.border }} thumbColor={colors.bg} />
          </View>
        )}
      />
      <Text style={formStyles.hint}>Что не запланировано и не потрачено, откладывается в категорию «Сбережения». Запоминается на следующие месяцы.</Text>
    </View>
  );
}
