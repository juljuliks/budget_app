// A month's plan: its items, its budget, what came in and what was spent (in the screen's currency).
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Currency } from '@/db/fx';
import { ensureMonthPlan, getPlanBudget, listPlan, monthIncome, monthStats, parseYm, PlanBudget, planConverter, planCurrency, PlanItem, unplannedSpent } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

export type SpentBy = { byCategory: Map<number, number>; total: number };

export function usePlanData(ym: string, currency: Currency) {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  // amount to distribute (e.g. salary) in its own currency; null = not set (shown as 0, no cap)
  const [budget, setBudget] = useState<PlanBudget | null>(null);
  // converts an amount to the screen's currency on the plan's rate date (null: no rate known)
  const [toShown, setToShown] = useState<(minor: number, from: Currency) => number | null>(() => () => null);
  // and back: an amount in the screen's currency in another one (the savings in the budget's currency)
  const [fromShown, setFromShown] = useState<(minor: number, to: Currency) => number | null>(() => () => null);
  const [income, setIncome] = useState(0);
  // spent outside the plan this month, in the screen's currency
  const [unplannedSpentMinor, setUnplannedSpent] = useState(0);
  // the month's spending by category (the savings forecast) and in all, in the screen's currency
  const [spentBy, setSpentBy] = useState<SpentBy>({ byCategory: new Map(), total: 0 });
  // the currency stored for the month in plan_months (carried from the previous month when new)
  const [storedCurrency, setStoredCurrency] = useState<Currency>(currency);

  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load plan');
  const load = useCallback(() => {
    // answers of a previous month / currency (switched quickly) are dropped
    const keep = latest();
    started();
    const { year, month } = parseYm(ym);
    Promise.all([listPlan(ym, currency), getPlanBudget(ym), monthIncome(ym, currency), planConverter(ym), monthStats(year, month, currency), ensureMonthPlan(ym).then(() => planCurrency(ym))])
      .then(keep(([plan, b, inc, conv, stats, pc]) => {
        setItems(plan); setBudget(b); setIncome(inc); setUnplannedSpent(unplannedSpent(stats));
        // a fund takes its contribution, and what was spent past what it saved
        const funds = stats.funds.map((f): [number, number] => [f.category_id, f.contribution_minor + f.shortage_minor]);
        setSpentBy({ byCategory: new Map([...stats.categories.filter((c) => c.category_id !== null).map((c): [number, number] => [c.category_id!, c.spent_minor]), ...funds]),
          total: stats.spent_minor + stats.funds.reduce((a, f) => a + f.contribution_minor, 0) });
        setToShown(() => (minor: number, from: Currency) => conv(minor, from, currency));
        setFromShown(() => (minor: number, to: Currency) => conv(minor, currency, to));
        setStoredCurrency(pc);
      }))
      .catch(keep(fail));
  }, [ym, currency, latest, started, fail]);

  // on focus, and again whenever load changes while focused (useFocusEffect re-runs on a new callback)
  useFocusEffect(load);
  // a sheet over it changed the month (the month before's "Итоги": what it sends here)
  useEffect(() => onTransactionsChanged(load), [load]);

  return { items, budget, toShown, fromShown, income, unplannedSpentMinor, spentBy, load, failed, storedCurrency };
}
