// The spending's dynamics: the categories and the last 12 months of spending, read again on focus and on any change.
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Currency } from '@/db/fx';
import { trendsData, TrendsData } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

/** `months`: how far back (the month stats' «к обычному» needs just the 3 before this one). */
export function useTrendsData(currency: Currency, months = 12, enabled = true) {
  const [data, setData] = useState<TrendsData | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load trends');
  const load = useCallback(() => {
    if (!enabled) return;
    const keep = latest();
    started();
    trendsData(currency, months).then(keep(setData)).catch(keep(fail));
  }, [currency, months, enabled, latest, started, fail]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);
  return { data: enabled ? data : null, failed, load };
}
