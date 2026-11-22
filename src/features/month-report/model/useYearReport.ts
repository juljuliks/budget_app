import { useCallback, useEffect, useState } from 'react';
import type { Currency } from '@/db/fx';
import { yearReport, YearReport } from '@/db/yearReport';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

/**
 * «Итоги года» of `year` (null = none open), reloaded when the data change; `failed` with `load` to try again. In
 * `shown` (the year's stats: the currency picked), else the system one.
 */
export function useYearReport(year: number | null, shown?: Currency) {
  const system = useDisplayCurrency();
  const currency = shown ?? system;
  const [report, setReport] = useState<YearReport | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load year report');
  const load = useCallback(() => {
    const keep = latest();
    started();
    if (year !== null) yearReport(year, currency).then(keep(setReport)).catch(keep(fail));
  }, [year, currency, latest, started, fail]);
  useEffect(() => {
    setReport(null);
    load();
    return year !== null ? onTransactionsChanged(load) : undefined;
  }, [year, load]);
  return { report, failed, load };
}
