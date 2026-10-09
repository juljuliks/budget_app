import React from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { PlanBudget, unplannedOf } from '@/db/plans';
import { formatWithCurrency, toInputValue } from '@/shared/lib/money';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import TextInputModal from '@/shared/ui/TextInputModal';
import { useLoadedForm } from '@/shared/ui/form';
import type { BudgetForm } from '../model/budgetForm';
import { SavingsSwitch, ShareField } from './BudgetFields';
import { RING_LOCKED, RING_UNPLANNED } from './palette';

type Props = {
  visible: boolean;
  budget: PlanBudget | null;
  currency: Currency;
  /** what is planned, in the screen's currency */
  planned: number;
  hint: string;
  toShown: (minor: number, from: Currency) => number | null;
  onSubmit: (text: string, form: UseFormReturn<BudgetForm>) => Promise<string | null>;
  onClose: () => void;
};

/** The month's budget: the amount and its currency, "Отложить сразу", the share outside the plan, where the rest goes. */
export default function BudgetSheet({ visible, budget, currency, planned, hint, toShown, onSubmit, onClose }: Props) {
  // the amount and the currency it was entered in
  const form = useLoadedForm<BudgetForm>(visible ? {
    value: toInputValue(budget?.amount_minor), currency: budget?.currency ?? currency,
    unplanned: budget && unplannedOf(budget) ? toInputValue(unplannedOf(budget)) : '',
    toSavings: budget?.to_savings ?? true, locked: budget?.locked_minor ? toInputValue(budget.locked_minor) : '',
  } : null, visible);
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
      <ShareField
        form={form} name="locked" other="unplanned" planned={planned} toShown={toShown} screen={currency}
        title="Отложить сразу" icon color={RING_LOCKED}
        hint={(v, cur) => (v > 0 ? `${formatWithCurrency(v, cur)} сразу в сбережения: план и траты вне плана их не займут.`
          : 'Сколько бюджета сразу заблокировать для сбережений: план и траты вне плана их не займут.')}
      />
      <ShareField
        form={form} name="unplanned" other="locked" planned={planned} toShown={toShown} screen={currency}
        title="На траты вне плана" color={RING_UNPLANNED}
        hint={(v, cur) => (v > 0 ? `${formatWithCurrency(v, cur)} на траты вне плана — план их не займёт.`
          : 'Сколько бюджета оставить на траты вне плана. Предупреждение в статистике — только если они больше.')}
      />
      <SavingsSwitch form={form} />
    </TextInputModal>
  );
}
