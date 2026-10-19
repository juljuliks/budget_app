// A repeating payment's period in the table: a count (period_months) and its unit (period_unit); in the code — one
// number (schedule.ts Period: months > 0, weeks < 0, once 0).
import type { Period } from './schedule';

type Unit = 'month' | 'week' | 'once';

/** The period of a row of recurring_payments (`s` — its alias with the dot, 's.'). */
export const periodSql = (s = '') =>
  `CASE ${s}period_unit WHEN 'once' THEN 0 WHEN 'week' THEN -${s}period_months ELSE ${s}period_months END`;

/** The table's count and unit of a period. */
export const periodColumns = (p: Period): [number, Unit] => (p === 0 ? [1, 'once'] : p < 0 ? [-p, 'week'] : [p, 'month']);
