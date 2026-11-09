// «Мерчанты» of a category's «Динамика»: the ones spent at most in the period picked, read again on any change.
import { useCallback, useEffect, useState } from 'react';
import type { Currency } from '@/db/fx';
import { CategoryMerchant, categoryMerchants } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';

/** this month, this year (from January 1st, as the stats' «За год»), all the time */
export type MerchantsPeriod = 'month' | 'year' | 'all';

/** The period's first moment, unix seconds; 0 — all the time. */
export function periodFrom(period: MerchantsPeriod, now = new Date()): number {
  if (period === 'all') return 0;
  return new Date(now.getFullYear(), period === 'month' ? now.getMonth() : 0, 1).getTime() / 1000;
}

/** null while loading (or failed: the block says nothing). */
export function useCategoryMerchants(id: number, currency: Currency, period: MerchantsPeriod) {
  const [list, setList] = useState<CategoryMerchant[] | null>(null);
  const latest = useLatestRequest();
  const load = useCallback(() => {
    const keep = latest();
    categoryMerchants(id, currency, periodFrom(period))
      .then(keep(setList))
      .catch(keep((e: unknown) => console.error('load category merchants failed', e)));
  }, [id, currency, period, latest]);
  useEffect(() => { load(); return onTransactionsChanged(load); }, [load]);
  return list;
}
