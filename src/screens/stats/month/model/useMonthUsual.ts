// The current month's categories spent well off their usual by the same days: "+44% к обычному" under their rows.
import { useMemo } from 'react';
import type { Currency } from '@/db/fx';
import { currentYm } from '@/db/plans';
import { dayKeyOf } from '@/shared/lib/dateRange';
import { USUAL_OF } from '@/stats/trends';
import { pctText, trendLists } from '../../trends/model/trendsView';
import { useTrendsData } from '../../trends/model/useTrendsData';

/** By category: what to say under its row; empty for another month than the current one. */
export function useMonthUsual(ym: string, currency: Currency): Map<number, string> {
  // this month and the months its usual is of
  const { data } = useTrendsData(currency, USUAL_OF.month + 1, ym === currentYm());
  return useMemo(() => {
    if (!data) return new Map();
    const lists = trendLists(data, 'month', dayKeyOf(new Date()), Infinity);
    // nothing usually, or nothing spent yet: no % to say under the row
    return new Map([...lists.more, ...lists.less].filter((r) => r.trend.pct !== null && r.trend.cur > 0).map((r) => [r.category.id, pctText(r.trend)]));
  }, [data]);
}
