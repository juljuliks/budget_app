// What is ahead in the current month, under its bar as three tiles: the obligatory payments still to pay, what is left
// of the limits for the days left (each in its rhythm), and the overspends by category. No React.
import { CategoryStat, MonthStats, NormPeriod, spentOf, unplannedSpent } from '@/db/plans';

/** A category in a tile's list: what it has (left to pay, left of its limit, past its plan). */
export type AheadItem = { id: number; label: string; minor: number };
/** A limit: what is left of it and for its rhythm a share per day / week / 2 weeks of the days left. */
export type LimitItem = AheadItem & { norm: NormPeriod; per: number | null };

export type MonthBreakdown = {
  /** obligatory payments not paid in full: what is left of each, the most first */
  payments: { total: number; items: AheadItem[] };
  /** each limit's own left (an overspend not taken off); `days` — left in the month, today too */
  limits: { total: number; days: number; items: LimitItem[] };
  /** past the plan: each category, and the spending outside the plan past its share ("Вне плана", id 0) */
  over: { total: number; items: AheadItem[] };
};

const labelOf = (c: CategoryStat) => `${c.emoji || ''} ${c.name}`.trim();
const RHYTHM_DAYS: Record<NormPeriod, number> = { day: 1, week: 7, '2weeks': 14, month: 0 };
const sum = (items: AheadItem[]) => items.reduce((a, i) => a + i.minor, 0);
const most = <T extends AheadItem>(items: T[]) => items.sort((a, b) => b.minor - a.minor);

/**
 * `share` — the budget's share for spending outside the plan; `today` — the day of the month and its days.
 */
export function monthBreakdown(stats: MonthStats, share: number, today: { day: number; days: number }): MonthBreakdown {
  const planned = stats.categories.filter((c) => c.limit_minor !== null && c.limit_minor > 0 && c.category_id !== null);
  const fixed = planned.filter((c) => c.plan_kind === 'fixed');
  const limits = planned.filter((c) => c.plan_kind !== 'fixed');
  const days = Math.max(1, today.days - today.day + 1);
  const payments = most(fixed.filter((c) => spentOf(c) < c.limit_minor!)
    .map((c) => ({ id: c.category_id!, label: labelOf(c), minor: c.limit_minor! - spentOf(c) })));
  const left = most(limits.filter((c) => spentOf(c) < c.limit_minor!).map((c) => {
    const minor = c.limit_minor! - spentOf(c);
    const norm = c.plan_norm ?? 'month';
    // a share per its rhythm only when the days left hold more than one of it
    const per = norm !== 'month' && days > RHYTHM_DAYS[norm] ? (minor / days) * RHYTHM_DAYS[norm] : null;
    return { id: c.category_id!, label: labelOf(c), minor, norm, per };
  }));
  const over = planned.filter((c) => spentOf(c) > c.limit_minor!)
    .map((c) => ({ id: c.category_id!, label: labelOf(c), minor: spentOf(c) - c.limit_minor! }));
  const outside = unplannedSpent(stats) - share;
  if (share > 0 && outside > 0) over.push({ id: 0, label: '🎲 Вне плана', minor: outside });
  return {
    payments: { total: sum(payments), items: payments },
    limits: { total: sum(left), days, items: left },
    over: { total: sum(over), items: most(over) },
  };
}
