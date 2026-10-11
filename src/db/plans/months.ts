// Month keys ('2026-10'), their ranges, the plan's rate day; the default currency.
import { Currency, dateKey, isCurrency } from '../fx';

/** The default currency: plans start in it, and stats show it until another is picked. */
export const BUDGET_CURRENCY: Currency = 'GEL';

/** Month key "2026-10". month is 0-based like Date#getMonth. */
export function ymOf(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseYm(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m - 1 };
}

/** [start, end) of a calendar month in unix seconds, local time. month is 0-based. */
export function monthRange(year: number, month: number): [number, number] {
  return [new Date(year, month, 1).getTime() / 1000, new Date(year, month + 1, 1).getTime() / 1000];
}

/** Start of the month `ym` in unix seconds (local time). */
export function monthStart(ym: string): number {
  const { year, month } = parseYm(ym);
  return monthRange(year, month)[0];
}

export function currentYm(now = new Date()): string {
  return ymOf(now.getFullYear(), now.getMonth());
}

/** The day a month's plan amounts are converted on: its last day, or today for the current / a coming month. */
export function planRateDate(ym: string): string {
  const { year, month } = parseYm(ym);
  return dateKey(Math.min(monthRange(year, month)[1] - 1, Date.now() / 1000));
}

export const asCurrency = (v: string | null | undefined): Currency => (isCurrency(v) ? v : BUDGET_CURRENCY);
