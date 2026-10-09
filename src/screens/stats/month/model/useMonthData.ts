// A month's spending by category, its share for spending outside the plan, and (the current month) today's limits.
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Currency } from '@/db/fx';
import { currentYm, monthStats, MonthStats, ymOf } from '@/db/plans';
import { onTransactionsChanged } from '@/events';
import { unplannedShare } from '@/entities/plan';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { loadNorms, Norms } from '@/stats/norms';

export function useMonthData(year: number, month: number, currency: Currency) {
  const [stats, setStats] = useState<MonthStats | null>(null);
  // the month's share for spending outside the plan (0 without a budget)
  const [share, setShare] = useState(0);
  // the current month: each flexible category's norm window around today (today / this week / these 2 weeks)
  const [today, setToday] = useState<Norms | null>(null);

  const latest = useLatestRequest();
  const load = useCallback(() => {
    // answers of a previous month (switched quickly) are dropped
    const keep = latest();
    monthStats(year, month, currency).then(keep(setStats)).catch((e) => console.error('load stats failed', e));
    unplannedShare(ymOf(year, month), currency).then(keep(setShare)).catch((e) => console.error('load unplanned share failed', e));
    if (ymOf(year, month) === currentYm()) {
      const d = dayKeyOf(new Date());
      loadNorms({ from: d, to: d }, currency).then(keep(setToday)).catch((e) => console.error('load norms failed', e));
    } else setToday(null);
  }, [year, month, currency, latest]);

  // on focus, and again whenever load changes while focused (useFocusEffect re-runs on a new callback): no extra useEffect
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  return { stats, share, today, load };
}
