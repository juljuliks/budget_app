// A category's page: its fund (none — null) and what it puts in this month, read again on any change; whether the
// category can have one (not a system or a transfer one).
import { useCallback, useEffect, useState } from 'react';
import { getCategory, isSystemCategory, isTransferCategory } from '@/db/categories';
import { fundThisMonth, FundThisMonth } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';

export type CategoryFund = { allowed: boolean; label: string; month: FundThisMonth | null };

/** null while loading. */
export function useCategoryFund(categoryId: number) {
  const [data, setData] = useState<CategoryFund | null>(null);
  const latest = useLatestRequest();
  const load = useCallback(() => {
    const keep = latest();
    Promise.all([getCategory(categoryId), fundThisMonth(categoryId)])
      .then(keep(([c, month]: [Awaited<ReturnType<typeof getCategory>>, FundThisMonth | null]) => setData({
        allowed: !!c && !isSystemCategory(c) && !isTransferCategory(c),
        label: c ? `${c.emoji || ''} ${c.name}`.trim() : '',
        month,
      })))
      .catch(keep((e: unknown) => console.error('load category fund failed', e)));
  }, [categoryId, latest]);
  useEffect(() => { load(); return onTransactionsChanged(load); }, [load]);
  return data;
}
