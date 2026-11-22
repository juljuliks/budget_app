import React from 'react';
import { Text } from 'react-native';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { PlanBudget, unplannedOf } from '@/db/plans';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import { useLockedPct } from '@/shared/settings/lockedPct';
import { navigationRef } from '@/shared/navigation/navigation';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import TextInputModal from '@/shared/ui/TextInputModal';
import { useLoadedForm } from '@/shared/ui/form';
import { formStyles } from '@/shared/theme/formStyles';
import { BudgetForm, lockedOfForm } from '../model/budgetForm';
import { ShareField } from './BudgetFields';
import LockedCard from './LockedCard';
import { RING_UNPLANNED } from './palette';

type Props = {
  visible: boolean;
  budget: PlanBudget | null;
  currency: Currency;
  /** the currency stored for this month (carried from the previous month); used as initial currency when budget is null */
  defaultCurrency: Currency;
  /** what is planned (the funds, the month before's carry too), in the screen's currency */
  planned: number;
  hint: string;
  toShown: (minor: number, from: Currency) => number | null;
  onSubmit: (text: string, form: UseFormReturn<BudgetForm>) => Promise<string | null>;
  onClose: () => void;
};

/**
 * The month's budget: the amount and its currency, «🔒 Отложить сразу» (its % — in the settings), the share outside the
 * plan, what is free in the plan (the rest: "Итоги месяца").
 */
export default function BudgetSheet({ visible, budget, currency, defaultCurrency, planned, hint, toShown, onSubmit, onClose }: Props) {
  // the amount and the currency it was entered in
  const form = useLoadedForm<BudgetForm>(visible ? {
    value: toInputValue(budget?.amount_minor), currency: budget?.currency ?? defaultCurrency,
    // the share of its own: what a cut of the plan covered this month stays on top of it
    unplanned: budget && unplannedOf({ ...budget, unplanned_cover_minor: 0 }) ? toInputValue(unplannedOf({ ...budget, unplanned_cover_minor: 0 })) : '',
  } : null, visible);
  const setting = useLockedPct();
  const [value, cur, share] = useWatch({ control: form.control, name: ['value', 'currency', 'unplanned'] });
  const amount = parseAmountOrZero(value ?? '') ?? 0;
  const locked = lockedOfForm(budget, setting, amount);
  // the plan in the budget's currency: screen → budget by the amount's own rate
  const inScreen = cur === currency ? amount : toShown(amount, cur) ?? amount;
  const plannedInBudget = inScreen > 0 ? Math.round((planned * amount) / inScreen) : planned;
  const free = amount - plannedInBudget - locked.locked - (parseAmountOrZero(share ?? '') ?? 0);
  const toSettings = () => { onClose(); navigationRef.navigate('Settings'); };
  return (
    <TextInputModal
      visible={visible}
      title="Бюджет месяца"
      hint={hint}
      form={form}
      placeholder="0"
      keyboardType="decimal-pad"
      maxLength={12}
      allowEmpty
      onSubmit={(text) => onSubmit(text, form)}
      onClose={onClose}
      inputAccessory={<Controller control={form.control} name="currency" render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />} />}
    >
      {/* parts of the budget the plan can't take */}
      {amount > 0 ? <LockedCard l={locked} currency={cur} onSettings={toSettings} /> : null}
      <ShareField
        form={form} planned={planned} reserved={locked.locked} toShown={toShown} screen={currency}
        title="На траты вне плана" color={RING_UNPLANNED}
        hint={(v, c) => (v > 0 ? `${formatWithCurrency(v, c)} на траты вне плана — план их не займёт.`
          : 'Сколько бюджета оставить на траты вне плана. Предупреждение в статистике — только если они больше.')}
      />
      {amount > 0 && free >= 0 ? (
        <Text style={formStyles.hint}>
          {free > 0 ? `Свободно в плане: ${formatWithCurrency(free, cur)} — не распределите, уйдёт в 💰 Сэкономлено` : 'Свободно в плане: 0 — всё распределено'}
        </Text>
      ) : null}
    </TextInputModal>
  );
}
