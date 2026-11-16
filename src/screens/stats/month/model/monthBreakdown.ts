// What the month's "Осталось" is made of, under its bar (opened by its chevron): the obligatory payments still to pay
// (each by name), what is left of the limits and of the share outside the plan, each with its overspend (so the lines
// add up to the bar's "Осталось" / "Перерасход"), and — the current month — what is free a day after the payments. No React.
import { CategoryStat, MonthStats, spentOf, unplannedSpent } from '@/db/plans';

export type UnpaidPayment = { id: number; label: string; left: number };

export type MonthBreakdown = {
  /** obligatory payments (one-off and regular): all of them with an amount, those paid in full, what is left to pay */
  payments: { count: number; paid: number; plan: number; left: number; over: number; unpaid: UnpaidPayment[] } | null;
  /** what is left of the limits (each one's own) and their plan; `over` — spent past theirs, the categories over it */
  limits: { left: number; limit: number; over: number } | null;
  /** what is left of the share outside the plan, or spent past it */
  outside: { left: number; share: number; over: number } | null;
  /** the current month: what's left after the payments still to pay, a day till the month's end (today too) */
  perDay: { value: number; days: number } | null;
};

const labelOf = (c: CategoryStat) => `${c.emoji || ''} ${c.name}`.trim();

/**
 * The month's breakdown: `share` — the budget's share for spending outside the plan; `today` — the day of the month
 * when it is the current one (else none: no "a day").
 */
export function monthBreakdown(stats: MonthStats, share: number, today?: { day: number; days: number }): MonthBreakdown {
  const planned = stats.categories.filter((c) => c.limit_minor !== null && c.limit_minor > 0 && c.category_id !== null);
  const fixed = planned.filter((c) => c.plan_kind === 'fixed');
  const limits = planned.filter((c) => c.plan_kind !== 'fixed');
  const unpaid = fixed.filter((c) => spentOf(c) < c.limit_minor!)
    .map((c) => ({ id: c.category_id!, label: labelOf(c), left: c.limit_minor! - spentOf(c) }))
    .sort((a, b) => b.left - a.left);
  const paymentsLeft = unpaid.reduce((a, u) => a + u.left, 0);
  const outsideSpent = unplannedSpent(stats);
  const overOf = (cats: CategoryStat[]) => cats.reduce((a, c) => a + Math.max(0, spentOf(c) - c.limit_minor!), 0);
  // as the bar's "Осталось": the plan and the share, less all spent
  const left = Math.round(stats.planned_minor + share) - stats.spent_minor;
  const days = today ? today.days - today.day + 1 : 0;
  return {
    payments: fixed.length ? {
      count: fixed.length, paid: fixed.length - unpaid.length, plan: fixed.reduce((a, c) => a + c.limit_minor!, 0), left: paymentsLeft, over: overOf(fixed), unpaid,
    } : null,
    limits: limits.length ? {
      left: limits.reduce((a, c) => a + Math.max(0, c.limit_minor! - spentOf(c)), 0),
      limit: limits.reduce((a, c) => a + c.limit_minor!, 0),
      over: overOf(limits),
    } : null,
    outside: share > 0 ? { left: Math.max(0, share - outsideSpent), share, over: Math.max(0, outsideSpent - share) } : null,
    perDay: days > 0 && left - paymentsLeft > 0 ? { value: (left - paymentsLeft) / days, days } : null,
  };
}
