// The reports as stories only while fresh: a month's — from the 24th of it to the 7th of the next (till its end —
// «пока»), the year's — from 24 December to 7 January; the rest of the time, their pages. Pure.

/** the first and the last day a report is fresh around its period's end */
export const FRESH_FROM_DAY = 24;
export const FRESH_TO_DAY = 7;

const ymOfDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The month whose report is fresh on `now` (its stories), and how many days are left of it; null — none. */
export function freshMonth(now: Date): { ym: string; daysLeft: number } | null {
  const d = now.getDate();
  if (d >= FRESH_FROM_DAY) {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, FRESH_TO_DAY);
    return { ym: ymOfDate(now), daysLeft: Math.round((end.getTime() - new Date(now.getFullYear(), now.getMonth(), d).getTime()) / 86400000) };
  }
  if (d <= FRESH_TO_DAY) return { ym: ymOfDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), daysLeft: FRESH_TO_DAY - d };
  return null;
}

/** The year whose report is fresh on `now` (24 December — 7 January), and the days left of it; null — none. */
export function freshYear(now: Date): { year: number; daysLeft: number } | null {
  const m = now.getMonth();
  const d = now.getDate();
  if (m === 11 && d >= FRESH_FROM_DAY) return { year: now.getFullYear(), daysLeft: 31 - d + FRESH_TO_DAY };
  if (m === 0 && d <= FRESH_TO_DAY) return { year: now.getFullYear() - 1, daysLeft: FRESH_TO_DAY - d };
  return null;
}

/** Whether `ym`'s report opens as stories on `now`. */
export const isMonthFresh = (ym: string, now = new Date()) => freshMonth(now)?.ym === ym;
/** Whether `year`'s report opens as stories on `now`. */
export const isYearFresh = (year: number, now = new Date()) => freshYear(now)?.year === year;
