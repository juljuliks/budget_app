// The "Подписки" sheet of a month: its charges, the others, those without a day (and the merchants of "Подписки" with
// no subscription), what the plan has for it — loaded when opened, again on each change.
import { useCallback, useEffect, useState } from 'react';
import { subscriptionsCategoryId } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { listPlan, monthSubscriptions, MonthSubscriptions } from '@/db/plans';
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
};

export function useSubscriptions(ym: string | null, currency: Currency) {
  const [data, setData] = useState<SubscriptionsData | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load subscriptions');
  const load = useCallback(() => {
    if (ym === null) return;
    const keep = latest();
    started();
    (async (): Promise<SubscriptionsData> => {
      const categoryId = await subscriptionsCategoryId();
      const [month, merchants, plan] = await Promise.all([
        monthSubscriptions(ym, currency), categoryId === null ? [] : merchantsWithoutSubscription(categoryId), listPlan(ym, currency)]);
      const item = plan.find((i) => i.system === 'subs');
      return { ...month, merchants, planned_minor: item ? item.converted_minor : null, by_hand: !!item && item.kind !== 'subs' };
    })().then(keep(setData)).catch(keep(fail));
  }, [ym, currency, latest, started, fail]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);
  return { data, failed, load };
}
