import { useCallback, useEffect, useState } from 'react';
import { yearReport, YearReport } from '@/db/yearReport';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

/** «Итоги года» of `year` (null = none open), reloaded when the data change; `failed` with `load` to try again. */
export function useYearReport(year: number | null) {
  const currency = useDisplayCurrency();
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
