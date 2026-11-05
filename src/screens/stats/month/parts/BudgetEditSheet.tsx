import React from 'react';
import type { Currency } from '@/db/fx';
import BudgetSheet from '../../plan/parts/BudgetSheet';
import { usePlanData } from '../../plan/model/usePlanData';
import { usePlanActions } from '../../plan/model/usePlanActions';
import { planView } from '../../plan/model/planView';

type Props = { ym: string; currency: Currency; visible: boolean; onClose: () => void };

/** Opens the month's budget sheet from stats (long press on the «Сбережения» header). */
export default function BudgetEditSheet({ ym, currency, visible, onClose }: Props) {
  const data = usePlanData(ym, currency);
  const { items, budget, toShown, load, storedCurrency } = data;
  const actions = usePlanActions(ym, load);
  if (!items) return null;
  const p = planView({ ...data, items, ym, currency, hidden: false });
  return (
    <BudgetSheet
      visible={visible}
      budget={budget}
      currency={currency}
      defaultCurrency={storedCurrency}
      planned={p.claimed}
      hint={p.budgetHint}
      toShown={toShown}
      onSubmit={actions.saveBudget}
      onClose={onClose}
    />
  );
}
