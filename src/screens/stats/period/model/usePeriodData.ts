// A period's spending by category and, when it is measured against the plan, its limits and its month outside the plan.
import { useCallback, useEffect, useState } from 'react';
import { averageFullMonths, periodStats, PeriodStats } from '@/db/plans';
import type { Currency } from '@/db/fx';
import { onTransactionsChanged } from '@/events';
import { unplannedMonth, UnplannedMonth } from '@/entities/plan';
import { DayRange, rangeDays, rangeToUnix } from '@/shared/lib/dateRange';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { loadNorms, Norms } from '@/stats/norms';

/** Periods up to this long are measured against the plan (its share for these days); longer ones aren't. */
export const PACE_MAX_DAYS = 31;

export function usePeriodData(range: DayRange, currency: Currency) {
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [norms, setNorms] = useState<Norms | null>(null);
  // the month the period ends in: which categories have a plan, the spending outside it and its share (a day / week only)
  const [month, setMonth] = useState<UnplannedMonth | null>(null);
  // a long period: the average over its full months with data (undefined = loading, null = none yet)
  const [average, setAverage] = useState<{ average_minor: number; months: number } | null | undefined>(undefined);
  const days = rangeDays(range);
  // measured against the plan only within one month: a period across months (or a year) is just its categories
  const sameMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
  const pace = days <= PACE_MAX_DAYS && sameMonth;

  const latest = useLatestRequest();
  const load = useCallback(() => {
    // answers of a previous period (switched quickly) are dropped
    const keep = latest();
    const { from, to } = rangeToUnix(range);
    if (pace) {
      // a day / week / 2-week limit not touched in the period but spent earlier in the month is listed too (0 ₾):
      // to see its limit grow after a day without spending
      loadNorms(range, currency).then((n) => {
        const planned = [...n.byCategory].filter(([id, p]) => p.kind === 'limit' && p.rhythm !== 'month' && p.periodNorm > 0
          && (n.monthToDate.get(id) ?? 0) > 0).map(([id]) => id);
        return Promise.all([periodStats(from, to, currency, planned), unplannedMonth(n.ym, currency, range.to)])
          .then(keep(([s, u]: [PeriodStats, UnplannedMonth]) => { setNorms(n); setMonth(u); setStats(s); }));
      }).catch((e) => console.error('load period stats failed', e));
    } else {
      setNorms(null);
      setMonth(null);
      periodStats(from, to, currency).then(keep(setStats)).catch((e) => console.error('load period stats failed', e));
    }
    if (!pace) averageFullMonths(range.from, range.to, currency).then(keep(setAverage)).catch((e) => console.error('load average failed', e));
  }, [range, currency, pace, latest]);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  return { stats, norms, month, average, days, pace };
}
