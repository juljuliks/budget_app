import { useEffect, useState } from 'react';
import type { Currency } from '@/db/fx';
import { reportCurrency } from '@/db/report';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';

/**
 * A month's report page: its budget's currency and the system one; the page opens in the budget's, the other picked
 * by hand (not kept). null — the budget's not read yet.
 */
export function useReportCurrency(
  ym: string,
  budgetOf: (ym: string, fallback: Currency) => Promise<Currency> = reportCurrency,
) {
  const system = useDisplayCurrency();
  const [budget, setBudget] = useState<Currency | null>(null);
  const [picked, setPicked] = useState<Currency | null>(null);
  useEffect(() => {
    let on = true;
    budgetOf(ym, system)
      .then((c) => {
        if (on) setBudget(c);
      })
      .catch((e) => console.error('load report currency failed', e));
    return () => {
      on = false;
    };
  }, [ym, system, budgetOf]);
  return { budget, system, shown: picked ?? budget, pick: setPicked };
}
