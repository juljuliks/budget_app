// A category's subscriptions on its page ("Подписки" on): each with its next charge, and its merchants without one —
// loaded when shown, again on each change.
import { useCallback, useEffect, useState } from 'react';
import { LastCharge, merchantsWithoutPayment, paymentNext, paymentsOfCategory, RecurringPayment } from '@/db/recurring';
import { onTransactionsChanged } from '@/domain/events';

export type CategorySubscriptions = { subs: Array<{ sub: RecurringPayment; next: string | null }>; merchants: LastCharge[] };

export function useCategorySubscriptions(categoryId: number): CategorySubscriptions | null {
  const [data, setData] = useState<CategorySubscriptions | null>(null);
  const load = useCallback(() => {
    (async () => {
      const [all, merchants] = await Promise.all([paymentsOfCategory(categoryId), merchantsWithoutPayment(categoryId)]);
      const own = all.filter((p) => p.merchant_key);
      const nexts = await Promise.all(own.map((p) => paymentNext(p.id)));
      return { subs: own.map((sub, i) => ({ sub, next: nexts[i] })), merchants };
    })().then(setData).catch((e) => console.error('load category subscriptions failed', e));
  }, [categoryId]);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);
  return data;
}
