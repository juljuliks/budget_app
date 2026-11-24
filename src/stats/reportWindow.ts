// The reports as stories only while fresh: a month's — its last 7 days and the first 7 of the next (till its end —
// «пока»), the year's — the same around its end, 25 December to 7 January; the rest of the time, their pages. Pure.

/** the days a report is fresh before its period's end, and after it */
export const FRESH_DAYS = 7;
const FRESH_TO_DAY = FRESH_DAYS;
/** the first day of the last FRESH_DAYS of `now`'s month (the 24th of a 30-day one) */
const freshFrom = (now: Date) => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - FRESH_DAYS + 1;

const ymOfDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The month whose report is fresh on `now` (its stories), and how many days are left of it; null — none. */
export function freshMonth(now: Date): { ym: string; daysLeft: number } | null {
  const d = now.getDate();
  if (d >= freshFrom(now)) {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, FRESH_TO_DAY);
    return { ym: ymOfDate(now), daysLeft: Math.round((end.getTime() - new Date(now.getFullYear(), now.getMonth(), d).getTime()) / 86400000) };
  }
  if (d <= FRESH_TO_DAY) return { ym: ymOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), daysLeft: FRESH_TO_DAY - d };
  return null;
}

/** The year whose report is fresh on `now` (25 December — 7 January), and the days left of it; null — none. */
export function freshYear(now: Date): { year: number; daysLeft: number } | null {
  const m = now.getMonth();
  const d = now.getDate();
  if (m === 11 && d >= freshFrom(now)) return { year: now.getFullYear(), daysLeft: 31 - d + FRESH_TO_DAY };
  if (m === 0 && d <= FRESH_TO_DAY) return { year: now.getFullYear() - 1, daysLeft: FRESH_TO_DAY - d };
  return null;
}

/** Whether `ym`'s report opens as stories on `now`. */
export const isMonthFresh = (ym: string, now = new Date()) => freshMonth(now)?.ym === ym;
/** Whether `year`'s report opens as stories on `now`. */
export const isYearFresh = (year: number, now = new Date()) => freshYear(now)?.year === year;
