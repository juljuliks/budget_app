// «Покупки по дням» in a category's «Динамика»: its purchases on a month's calendar, a mark per purchase, and a tapped
// day's purchases — what is on the calendar and in its card.
import type { ImpulseRow } from '@/db/impulseStats';
import { MONTHS_GEN, WEEKDAYS_FULL } from '@/shared/lib/dates';
import type { DayKey } from '@/shared/lib/dateRange';

/** a day's mark: «импульсивная», «обдуманная», «без ответа» */
export type Mark = 'impulsive' | 'intentional' | 'unanswered';

export type DayPurchase = {
  tx: number;
  merchant: string | null;
  /** its parts in the category together */
  value: number;
  mark: Mark;
  /** an impulsive one's «Что подтолкнуло?» */
  mood: string | null;
};

const ORDER: Record<Mark, number> = { impulsive: 0, intentional: 1, unanswered: 2 };
const markOf = (r: ImpulseRow): Mark => (r.impulse === null ? 'unanswered' : r.impulse ? 'impulsive' : 'intentional');

/** Each day's purchases (a split one's parts together), the impulsive ones first, then the considered, then unanswered. */
export function purchasesByDay(rows: ImpulseRow[]): Map<DayKey, DayPurchase[]> {
  const byTx = new Map<number, DayPurchase & { day: DayKey }>();
  for (const r of rows) {
    const had = byTx.get(r.tx);
    if (had) had.value += r.value;
    else byTx.set(r.tx, { tx: r.tx, day: r.day, merchant: r.merchant, value: r.value, mark: markOf(r), mood: r.mood });
  }
  const days = new Map<DayKey, DayPurchase[]>();
  for (const { day, ...p } of byTx.values()) days.set(day, [...(days.get(day) ?? []), p]);
  for (const list of days.values()) list.sort((a, b) => ORDER[a.mark] - ORDER[b.mark] || a.tx - b.tx);
  return days;
}

/** A month's ('YYYY-MM') purchases: how many, for how much. */
export function monthTally(days: Map<DayKey, DayPurchase[]>, ym: string): { count: number; sum: number } {
  let count = 0;
  let sum = 0;
  for (const [day, list] of days) {
    if (!day.startsWith(ym)) continue;
    count += list.length;
    sum += list.reduce((s, p) => s + p.value, 0);
  }
  return { count, sum };
}

/** The month of the first purchase ('YYYY-MM'): the calendar goes back to it; none — the current one. */
export function firstMonth(days: Map<DayKey, DayPurchase[]>, today: DayKey): string {
  let first = today;
  for (const day of days.keys()) if (day < first) first = day;
  return first.slice(0, 7);
}

/** "понедельник, 16 ноября": a tapped day's card. */
export function dayCardTitle(day: DayKey): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${WEEKDAYS_FULL[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS_GEN[m - 1]}`;
}
