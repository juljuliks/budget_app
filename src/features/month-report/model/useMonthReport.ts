import { useEffect, useState } from 'react';
import { MonthReport, monthReport } from '@/db/report';
import { useDisplayCurrency } from '@/displayCurrency';
import { onTransactionsChanged } from '@/events';

/** The report of `ym` (null = none yet), reloaded when operations or plans change. */
export function useMonthReport(ym: string | null): MonthReport | null {
  const currency = useDisplayCurrency();
  const [report, setReport] = useState<MonthReport | null>(null);
  useEffect(() => {
    if (!ym) { setReport(null); return undefined; }
    let stale = false;
    const load = () => monthReport(ym, currency).then((r) => { if (!stale) setReport(r); }).catch((e) => console.error('load month report failed', e));
    setReport(null);
    load();
    const off = onTransactionsChanged(load);
    return () => { stale = true; off(); };
  }, [ym, currency]);
  return report;
}
