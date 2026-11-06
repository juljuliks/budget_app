// A category's impulsive purchases for its «Динамика»: the answers of the last months, read again on any change.
import { useCallback, useEffect, useState } from 'react';
import type { Currency } from '@/db/fx';
import { categoryAsksImpulse, ImpulseRow, impulseRows } from '@/db/impulseStats';
import { onTransactionsChanged } from '@/domain/events';
import { rangeToUnix } from '@/shared/lib/dateRange';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { impulseTrendView, impulseWindow } from './impulseTrendView';

/** null while loading (or failed: the block is left out, the rest of the page doesn't depend on it). */
export function useCategoryImpulse(id: number, currency: Currency, today: string) {
  const [data, setData] = useState<{ rows: ImpulseRow[]; on: boolean } | null>(null);
  const latest = useLatestRequest();
  const load = useCallback(() => {
    const keep = latest();
    const { from, to } = rangeToUnix(impulseWindow(today));
    Promise.all([impulseRows(from, to, currency, id), categoryAsksImpulse(id)])
      .then(keep(([rows, on]: [ImpulseRow[], boolean]) => setData({ rows, on })))
      .catch(keep((e: unknown) => console.error('load category impulse failed', e)));
  }, [id, currency, today, latest]);
  useEffect(() => { load(); return onTransactionsChanged(load); }, [load]);
  return data ? impulseTrendView(data.rows, data.on, today) : null;
}
