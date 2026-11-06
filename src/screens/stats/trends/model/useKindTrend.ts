// What a subscriptions' or a fund's «Динамика» needs besides the spending: the category's subscriptions (and each
// one's next charge) or its fund's ledger. Read again on any change.
import { useCallback, useEffect, useState } from 'react';
import { fundLedger, getFund, type Fund, type FundLedger } from '@/db/plans';
import { paymentNext, paymentsOfCategory, type RecurringPayment } from '@/db/recurring';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import type { TrendKind } from '@/stats/trendKind';

export type KindData =
  | { kind: 'subs'; payments: RecurringPayment[]; next: Map<number, string | null> }
  | { kind: 'fund'; fund: Fund; ledger: FundLedger };

/** null while loading, or for a kind needing nothing more. */
export function useKindTrend(categoryId: number, kind: TrendKind | null): KindData | null {
  const [data, setData] = useState<KindData | null>(null);
  const latest = useLatestRequest();
  const load = useCallback(() => {
    if (kind !== 'subs' && kind !== 'fund') { setData(null); return; }
    const keep = latest();
    const read = kind === 'subs'
      ? paymentsOfCategory(categoryId).then(async (payments): Promise<KindData> => ({
        kind, payments, next: new Map(await Promise.all(payments.map(async (p) => [p.id, await paymentNext(p.id)] as const))),
      }))
      : getFund(categoryId).then(async (fund): Promise<KindData | null> => (fund ? { kind: 'fund', fund, ledger: await fundLedger(fund) } : null));
    read.then(keep(setData)).catch(keep((e: unknown) => console.error('load trend kind failed', e)));
  }, [categoryId, kind, latest]);
  useEffect(() => { load(); return onTransactionsChanged(load); }, [load]);
  return data;
}
