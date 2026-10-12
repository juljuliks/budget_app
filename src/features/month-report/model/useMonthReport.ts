import { useCallback, useEffect, useState } from 'react';
import { MonthReport, monthReport } from '@/db/report';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

/** The report of `ym` (null = none yet), reloaded when operations or plans change; `failed` with `load` to try again. */
export function useMonthReport(ym: string | null) {
  const currency = useDisplayCurrency();
  const [report, setReport] = useState<MonthReport | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load month report');
  const load = useCallback(() => {
    // answers of a report closed or switched meanwhile are dropped
    const keep = latest();
    started();
    if (ym) monthReport(ym, currency).then(keep(setReport)).catch(keep(fail));
  }, [ym, currency, latest, started, fail]);
  useEffect(() => {
    setReport(null);
    load();
    return ym ? onTransactionsChanged(load) : undefined;
  }, [ym, load]);
  return { report, failed, load };
}
