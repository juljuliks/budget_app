// A category's impulsive purchases for its «Динамика»: all its purchases asked about or answered, read again on any
// change — the last months' answers for the share, every day of them for «Покупки по дням».
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Currency } from '@/db/fx';
import { categoryAsksImpulse, ImpulseRow, impulseRows } from '@/db/impulseStats';
import { onTransactionsChanged } from '@/domain/events';
import { rangeToUnix } from '@/shared/lib/dateRange';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { purchasesByDay } from '@/entities/transaction';
import { impulseTrendView, impulseWindow } from './impulseTrendView';

/** null while loading (or failed: the block is left out, the rest of the page doesn't depend on it) or nothing to show. */
export function useCategoryImpulse(id: number, currency: Currency, today: string) {
  const [data, setData] = useState<{ rows: ImpulseRow[]; on: boolean } | null>(null);
  const latest = useLatestRequest();
  const load = useCallback(() => {
    const keep = latest();
    const { to } = rangeToUnix(impulseWindow(today));
    Promise.all([impulseRows(0, to, currency, id), categoryAsksImpulse(id)])
      .then(keep(([rows, on]: [ImpulseRow[], boolean]) => setData({ rows, on })))
      .catch(keep((e: unknown) => console.error('load category impulse failed', e)));
  }, [id, currency, today, latest]);
  useEffect(() => { load(); return onTransactionsChanged(load); }, [load]);
  return useMemo(() => {
    if (!data) return null;
    const from = impulseWindow(today).from;
    const trend = impulseTrendView(data.rows.filter((r) => r.day >= from), data.on, today);
    return trend ? { trend, days: purchasesByDay(data.rows) } : null;
  }, [data, today]);
}
