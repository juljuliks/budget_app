// The month stats' «Сбережения»: this month — the plan's data worked out as the plan does (planView); a month over —
// what its "Итоги" laid out (savingsPlanFact). In the currency of the month's budget. Reloaded with the data and on
// focus (the "Итоги" sheet may have changed it).
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { currentYm, ensureMonthPlan, planCurrency } from '@/db/plans';
import { SavingsPlanFact, savingsPlanFact } from '@/db/reportSavings';
import { onTransactionsChanged } from '@/domain/events';
import { formatWithCurrency } from '@/shared/lib/money';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import type { PlanAmountTarget } from '@/entities/plan';
import { planView, PlanView } from '../../plan/model/planView';
import { usePlanData } from '../../plan/model/usePlanData';
import { currentSavings, pastSavings } from './savingsSection';

/** `shown`: the stats' currency, while the budget's isn't loaded yet; `currency` in the result — what the amounts are in. */
export function useMonthSavings(ym: string, shown: Currency, hidden: boolean) {
  const [budgetCurrency, setBudgetCurrency] = useState<Currency | null>(null);
  const currency = budgetCurrency ?? shown;
  const data = usePlanData(ym, currency);
  // with the currency it came in: switched to another one, it is stale until it loads
  const [fact, setFact] = useState<{ fact: SavingsPlanFact | null; currency: Currency } | null>(null);
  const past = ym < currentYm();
  const latest = useLatestRequest();
  const load = useCallback(() => {
    const keep = latest();
    ensureMonthPlan(ym).then(() => planCurrency(ym)).then(keep(setBudgetCurrency)).catch((e) => console.error('load budget currency failed', e));
    if (!past) return;
    savingsPlanFact(ym, currency).then(keep((f) => setFact({ fact: f, currency }))).catch((e) => console.error('load month savings failed', e));
  }, [ym, currency, past, latest]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  const money = (minor: number) => formatWithCurrency(minor, currency);
  if (past) return { section: fact?.currency === currency ? pastSavings(fact.fact, ym, money, hidden) : null, view: null, currency };
  if (!data.items || data.loadedCurrency !== currency || ym > currentYm()) return { section: null, view: null, currency };
  const view = planView({ ...data, items: data.items, ym, currency, hidden });
  return { section: currentSavings(view, money, hidden), view, currency };
}

/** A category of «Сбережения меньше на …»: its plan amount to change. null — not in the plan. */
export function lessTarget(view: PlanView | null, id: number): PlanAmountTarget | null {
  const item = view?.groups.flatMap((g) => g.items).find((i) => i.category_id === id) ?? view?.funds.find((i) => i.category_id === id);
  return item ? { ...item, label: categoryLabel(item) } : null;
}
