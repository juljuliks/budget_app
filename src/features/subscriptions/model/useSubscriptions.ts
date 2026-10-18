// A category's repeating payments in a month (its sheet): the charges, the others, those without a day (and its merchants
// with no payment), what the plan has for it — loaded when opened, again on each change.
import { useCallback, useEffect, useState } from 'react';
import type { Currency } from '@/db/fx';
import { listPlan, monthSubscriptions, MonthSubscriptions, planConverter, storedBudget } from '@/db/plans';
import { LastCharge, merchantsWithoutSubscription } from '@/db/subscriptions';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

export type SubscriptionsData = MonthSubscriptions & {
  /** the merchants of "Подписки" with no subscription: "Без даты списания" with the subscriptions without a day */
  merchants: LastCharge[];
  /** what the month's plan has for "Подписки" (the screen's currency); null — not in it */
  planned_minor: number | null;
  /** an amount put in by hand (no subscription has a day yet) */
  by_hand: boolean;
  /** the month's budget in the screen's currency (the sections' share of it); null — none */
  budget_minor: number | null;
};

export function useSubscriptions(ym: string | null, currency: Currency, categoryId: number) {
  const [data, setData] = useState<SubscriptionsData | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load subscriptions');
  const load = useCallback(() => {
    if (ym === null) return;
    const keep = latest();
    started();
    (async (): Promise<SubscriptionsData> => {
      const [month, merchants, plan, budget, conv] = await Promise.all([
        monthSubscriptions(ym, currency, undefined, categoryId), merchantsWithoutSubscription(categoryId), listPlan(ym, currency),
        storedBudget(ym), planConverter(ym)]);
      const item = plan.find((i) => i.category_id === categoryId);
      return {
        ...month, merchants, planned_minor: item ? item.converted_minor : null, by_hand: !!item && item.kind !== 'subs',
        budget_minor: budget ? conv(budget.amount_minor, budget.currency, currency) : null,
      };
    })().then(keep(setData)).catch(keep(fail));
  }, [ym, currency, categoryId, latest, started, fail]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);
  return { data, failed, load };
}
