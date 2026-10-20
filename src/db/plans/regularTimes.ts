// How many times a regular payment within the month comes in a month (pure: the plan's sheet counts it as it is typed).
import { countsFor, toleranceOf } from '../recurring/schedule';

export type Every = 'day' | 'week';

/** Monday — bit 0 … Sunday — bit 6. */
export const weekdayBit = (d: Date) => 1 << ((d.getDay() + 6) % 7);

/** Its days in `ym`: every day, or the `weekdays` (bits); none after `until` ('YYYY-MM-DD'). */
export function timesInMonth(ym: string, every: Every, weekdays: number, until?: string | null): number {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    if (until && `${ym}-${String(d).padStart(2, '0')}` > until) break;
    if (every === 'day' || weekdays & weekdayBit(new Date(y, m - 1, d))) n++;
  }
  return n;
}

/** Its days in `ym` ('YYYY-MM-DD'), up to `until`. */
export function regularDays(ym: string, every: Every, weekdays: number, until?: string | null): string[] {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    const day = `${ym}-${String(d).padStart(2, '0')}`;
    if (until && day > until) break;
    if (every === 'day' || weekdays & weekdayBit(new Date(y, m - 1, d))) out.push(day);
  }
  return out;
}

const dayNum = (day: string) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };

/**
 * How many of the weekdays were paid: the category's spending within the window of one (±3 days, less when the weekdays
 * are closer — Monday and Thursday: ±1, so a transfer on Wednesday isn't both) adding up to `unit` (two transfers
 * together; a small purchase isn't it); each spending pays one day only.
 */
export function paidTimes(days: string[], weekdays: number, all: Array<{ day: string; minor: number; answer?: number | null }>, unit: number): number {
  // only what counts for it ("Это оплата?"): of its amount, or answered yes
  const spent = all.filter((s) => countsFor(s, unit));
  const need = unit - toleranceOf(unit);
  const bits = [0, 1, 2, 3, 4, 5, 6].filter((i) => weekdays & (1 << i));
  const gaps = bits.map((b, i) => (i + 1 < bits.length ? bits[i + 1] - b : bits[0] + 7 - b));
  const window = Math.min(3, Math.floor((Math.min(...gaps) - 1) / 2));
  const used = new Set<number>();
  let n = 0;
  for (const day of days) {
    const near = spent.map((s, j) => j).filter((j) => !used.has(j) && Math.abs(dayNum(spent[j].day) - dayNum(day)) <= window);
    if (!near.length || near.reduce((a, j) => a + spent[j].minor, 0) < need) continue;
    near.forEach((j) => used.add(j));
    n++;
  }
  return n;
}
