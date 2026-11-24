// «Итоги года»: where a year's spending went. Pure: from the year's rows, converted. No React, no database.

/** A spending row of the year, converted to the report's currency (`value`; a refund — negative). */
export type YearRow = {
  value: number;
  own: number;
  currency: string;
  category_id: number | null;
  kind: string;
  occurred_at: number;
  merchant_key: string | null;
  raw_merchant: string | null;
};
/** A category's plan in a month (its limit, converted), for «перерасход в N из M месяцев». */
export type MonthLimit = { ym: string; category_id: number; limit: number };

const ymOfTs = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
/** a planned category's overspend under this share of its plan is noise (as the month's report) */
const OVER_TOLERANCE = 0.05;

/** `perMonth`: over the full months (null — none yet); `overIn` of `planned`: the full months it had a plan in */
export type TopCategory = { id: number; sum: number; perMonth: number | null; overIn: number; planned: number };

/**
 * The biggest categories of the year (`skip` — the funds', the transfers'): a month on average and how often it went past
 * its plan — over the `full` months (as the stats' «В среднем … в месяц»: over, with data from the 1st).
 */
export function topCategories(
  rows: YearRow[],
  limits: MonthLimit[],
  full: string[],
  skip: Set<number>,
  n: number | null = 5,
): TopCategory[] {
  const sums = new Map<number, number>();
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    if (r.category_id === null || skip.has(r.category_id)) continue;
    sums.set(r.category_id, (sums.get(r.category_id) ?? 0) + r.value);
    const k = `${ymOfTs(r.occurred_at)}|${r.category_id}`;
    byMonth.set(k, (byMonth.get(k) ?? 0) + r.value);
  }
  return [...sums]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n ?? sums.size)
    .map(([id, sum]) => {
      const own = limits.filter((l) => l.category_id === id && l.limit > 0 && full.includes(l.ym));
      const inFull = full.reduce((a, ym) => a + (byMonth.get(`${ym}|${id}`) ?? 0), 0);
      return {
        id,
        sum,
        perMonth: full.length ? Math.round(inFull / full.length) : null,
        overIn: own.filter((l) => (byMonth.get(`${l.ym}|${id}`) ?? 0) > l.limit * (1 + OVER_TOLERANCE)).length,
        planned: own.length,
      };
    });
}

/** The full months among `data` (ascending): over before `nowYm`, the first one only if the data start on its 1st. */
export function fullMonths(data: string[], nowYm: string, firstDay: string | null): string[] {
  return data.filter((ym) => ym < nowYm && !(firstDay && firstDay.slice(0, 7) === ym && !firstDay.endsWith('-01')));
}

/** What was spent a month on average over the `full` months; null — none. */
export function monthAverage(rows: YearRow[], full: string[]): number | null {
  if (!full.length) return null;
  return Math.round(
    rows.filter((r) => full.includes(ymOfTs(r.occurred_at))).reduce((a, r) => a + r.value, 0) / full.length,
  );
}
