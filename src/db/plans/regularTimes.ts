// How many times a regular payment within the month comes in a month (pure: the plan's sheet counts it as it is typed).

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
