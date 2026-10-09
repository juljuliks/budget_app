// A month's plan: its items, its budget, what came in and what was spent (in the screen's currency).
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Currency } from '@/db/fx';
import { getPlanBudget, listPlan, monthIncome, monthStats, parseYm, PlanBudget, planConverter, PlanItem, unplannedSpent } from '@/db/plans';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';

export type SpentBy = { byCategory: Map<number, number>; total: number };

export function usePlanData(ym: string, currency: Currency) {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  // amount to distribute (e.g. salary) in its own currency; null = not set (shown as 0, no cap)
  const [budget, setBudget] = useState<PlanBudget | null>(null);
  // converts an amount to the screen's currency on the plan's rate date (null: no rate known)
  const [toShown, setToShown] = useState<(minor: number, from: Currency) => number | null>(() => () => null);
  const [income, setIncome] = useState(0);
  // spent outside the plan this month, in the screen's currency
  const [unplannedSpentMinor, setUnplannedSpent] = useState(0);
  // the month's spending by category (the savings forecast) and in all, in the screen's currency
  const [spentBy, setSpentBy] = useState<SpentBy>({ byCategory: new Map(), total: 0 });

  const latest = useLatestRequest();
  const load = useCallback(() => {
    // answers of a previous month / currency (switched quickly) are dropped
    const keep = latest();
    const { year, month } = parseYm(ym);
    Promise.all([listPlan(ym, currency), getPlanBudget(ym), monthIncome(ym, currency), planConverter(ym), monthStats(year, month, currency)])
      .then(keep(([plan, b, inc, conv, stats]: [Awaited<ReturnType<typeof listPlan>>, Awaited<ReturnType<typeof getPlanBudget>>, number, Awaited<ReturnType<typeof planConverter>>, Awaited<ReturnType<typeof monthStats>>]) => {
        setItems(plan); setBudget(b); setIncome(inc); setUnplannedSpent(unplannedSpent(stats));
        setSpentBy({ byCategory: new Map(stats.categories.filter((c) => c.category_id !== null).map((c) => [c.category_id!, c.spent_minor])), total: stats.spent_minor });
        setToShown(() => (minor: number, from: Currency) => conv(minor, from, currency));
      }))
      .catch((e) => console.error('load plan failed', e));
  }, [ym, currency, latest]);

  // on focus, and again whenever load changes while focused (useFocusEffect re-runs on a new callback): no extra useEffect
  useFocusEffect(load);

  return { items, budget, toShown, income, unplannedSpentMinor, spentBy, load };
}
