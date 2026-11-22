// «История по месяцам» by years: a year's 12 months, the newest first — the ones with data as the history has them,
// the coming ones «впереди», the ones before the first operation «нет операций». No React.
import type { HistoryMonth } from '@/db/plans';

export type YearMonthRow = { ym: string; month: HistoryMonth | null; state: 'data' | 'future' | 'none' };

export function yearMonths(history: HistoryMonth[], year: number, nowYm: string): YearMonthRow[] {
  const by = new Map(history.map((m) => [m.ym, m]));
  return Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(12 - i).padStart(2, '0')}`;
    const month = by.get(ym) ?? null;
    return { ym, month, state: month ? 'data' : ym > nowYm ? 'future' : 'none' };
  });
}

/** The years the history has (its first one to the current), the newest first. */
export function historyYears(history: HistoryMonth[], nowYear: number): number[] {
  const first = history.reduce((a, m) => Math.min(a, Number(m.ym.slice(0, 4))), nowYear);
  return Array.from({ length: nowYear - first + 1 }, (_, i) => nowYear - i);
}
