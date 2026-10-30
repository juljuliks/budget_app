// The month stats' «Сбережения»: this month — the plan's data worked out as the plan does (planView); a month over —
// what its "Итоги" laid out (savingsPlanFact). Reloaded with the data and on focus (the "Итоги" sheet may have changed it).
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { currentYm } from '@/db/plans';
import { SavingsPlanFact, savingsPlanFact } from '@/db/reportSavings';
import { onTransactionsChanged } from '@/domain/events';
import { formatWithCurrency } from '@/shared/lib/money';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import type { PlanAmountTarget } from '@/entities/plan';
import { planView, PlanView } from '../../plan/model/planView';
import { usePlanData } from '../../plan/model/usePlanData';
import { currentSavings, pastSavings } from './savingsSection';

export function useMonthSavings(ym: string, currency: Currency, hidden: boolean) {
  const data = usePlanData(ym, currency);
  const [fact, setFact] = useState<SavingsPlanFact | null>(null);
  const past = ym < currentYm();
  const latest = useLatestRequest();
  const load = useCallback(() => {
    if (!past) return;
    const keep = latest();
    savingsPlanFact(ym, currency).then(keep(setFact)).catch((e) => console.error('load month savings failed', e));
  }, [ym, currency, past, latest]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const money = (minor: number) => formatWithCurrency(minor, currency);
  if (past) return { section: pastSavings(fact, ym, money, hidden), view: null };
  if (!data.items || ym > currentYm()) return { section: null, view: null };
  const view = planView({ ...data, items: data.items, ym, currency, hidden });
  return { section: currentSavings(view, money, hidden), view };
}

/** A category of «Сбережения меньше на …»: its plan amount to change. null — not in the plan. */
export function lessTarget(view: PlanView | null, id: number): PlanAmountTarget | null {
  const item = view?.groups.flatMap((g) => g.items).find((i) => i.category_id === id) ?? view?.funds.find((i) => i.category_id === id);
  return item ? { ...item, label: categoryLabel(item) } : null;
}
