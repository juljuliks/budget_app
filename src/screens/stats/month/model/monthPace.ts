// The month's bar with its payments' days: where the plan expects the spending to be on each day — the payments with a
// day whole on that day, all the rest (the limits, the share outside the plan, the payments without a day) evenly over
// the month — so a payment's mark sits where its day is on the money bar, and today's tick counts the payments due by
// today. Paid or not: a subscription by its merchant's operation, the others by the category's spending; a payment
// without a day — on its category's last spending day, once paid (not paid: no mark, spread evenly). No React.
import { CategoryStat, isPaid, MonthStats, PaymentMark, spentOf } from '@/db/plans';
import { daysInMonth } from '@/shared/lib/dateRange';

export type MarkStatus = 'paid' | 'missed' | 'ahead';

/** A payment on the bar: `at` — its place (0…1 of the month's plan), its category's emoji, its day and amount. */
export type BarMark = { key: string; at: number; category_id: number; emoji: string; name: string; day: string; minor: number; status: MarkStatus };

export type MonthPace = {
  marks: BarMark[];
  /** the current month: today's tick (0…1), the payments due by today counted whole; null — no payment has a day */
  tick: number | null;
  /** what the plan expects spent by the end of today (the current month) */
  expected: number | null;
};

const dayOf = (day: string) => Number(day.slice(8));
const labelOf = (c: CategoryStat) => c.emoji || c.name.slice(0, 1);

/**
 * `share` — the budget's share for spending outside the plan; `today` — YYYY-MM-DD (a past month: every day is past, no
 * tick).
 */
export function monthPace(stats: MonthStats, share: number, marks: PaymentMark[], today: string): MonthPace {
  const plannedAll = stats.planned_minor + share;
  const cats = new Map(stats.categories.filter((c) => c.category_id !== null && c.limit_minor).map((c) => [c.category_id!, c]));
  const dated = marks.flatMap((m) => {
    const c = cats.get(m.category_id);
    const minor = m.minor ?? c?.limit_minor ?? 0;
    // without a day: only when its spending covers it
    if (m.undated && c && spentOf(c) < minor * 0.99) return [];
    return c && minor > 0 && m.day.startsWith(stats.ym) ? [{ ...m, c, minor }] : [];
  });
  if (!dated.length || plannedAll <= 0) return { marks: [], tick: null, expected: null };
  const dim = daysInMonth(stats.ym);
  const flexible = Math.max(0, plannedAll - dated.reduce((a, m) => a + m.minor, 0));
  // the plan by the start of day `d` (before) or its end (with its payments)
  const by = (d: number, withDay: boolean) => flexible * ((withDay ? d : d - 1) / dim)
    + dated.reduce((a, m) => a + (dayOf(m.day) < d || (withDay && dayOf(m.day) === d) ? m.minor : 0), 0);
  // each category's payments in day order, paid while its spending covers them (isPaid: a rate's difference allowed)
  const covered = new Map<number, number>();
  const out: BarMark[] = dated.map((m, i) => {
    const cum = (covered.get(m.category_id) ?? 0) + m.minor;
    covered.set(m.category_id, cum);
    const paid = m.done ?? isPaid(spentOf(m.c), cum);
    return {
      key: `${m.category_id}-${m.day}-${i}`, at: Math.min(1, by(dayOf(m.day), false) / plannedAll), category_id: m.category_id,
      emoji: labelOf(m.c), name: m.c.name, day: m.day, minor: m.minor,
      status: paid ? 'paid' : m.day < today ? 'missed' : 'ahead',
    };
  });
  const current = today.startsWith(stats.ym);
  const expected = current ? by(dayOf(today), true) : null;
  return { marks: out, tick: expected === null ? null : Math.min(1, expected / plannedAll), expected };
}

/** Marks nearer than `gap` (0…1) to the one before: one, with their count and the worst state (not paid, then ahead). */
export function clusterMarks(marks: BarMark[], gap: number): Array<BarMark & { count: number }> {
  const rank: Record<MarkStatus, number> = { missed: 2, ahead: 1, paid: 0 };
  const out: Array<BarMark & { count: number }> = [];
  for (const m of [...marks].sort((a, b) => a.at - b.at)) {
    const last = out[out.length - 1];
    if (last && m.at - last.at < gap) {
      last.count += 1;
      if (rank[m.status] > rank[last.status]) last.status = m.status;
    } else out.push({ ...m, count: 1 });
  }
  return out;
}
