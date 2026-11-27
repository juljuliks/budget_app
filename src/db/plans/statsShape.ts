// The stats' shapes and the rules every screen counts by: what a category adds, when a payment is paid, sections.
import { Currency } from '../fx';
import { NormPeriod, PlanKind } from './types';

export type CategoryStat = {
  category_id: number | null; // null = uncategorized
  name: string;
  emoji: string | null;
  type_id: number | null;
  type_name: string | null;
  spent_minor: number;
  /** null = no plan (or amount not set) for this category this month */
  limit_minor: number | null;
  /** how the plan amount is shown: a progress bar (limit) or paid / not paid (fixed); null without a plan */
  plan_kind: PlanKind | null;
  /** a flexible plan item's norm rhythm for period stats; null without a plan */
  plan_norm: NormPeriod | null;
  /** chart color: the type's palette shade or the category's own (src/domain/colors.ts) */
  color: string;
  /** deleted category that still has spending in this month: can't be added to a plan */
  deleted: boolean;
  /**
   * a category of the transfer section: what was sent minus what came back, so spent_minor < 0 = more came than went
   * (shown "+", counted as nothing spent: it goes to the month's income, see monthIncome)
   */
  transfer: boolean;
  /**
   * planned in another currency than the stats' (month stats only): its spending (on each day's rate) and plan in
   * that currency, shown in the row instead
   */
  own?: { currency: Currency; spent_minor: number; limit_minor: number };
};

/** What a category adds to the spending totals: a transfer one that brought in more than went out adds nothing. */
export const spentOf = (c: Pick<CategoryStat, 'spent_minor' | 'transfer'>) =>
  c.transfer ? Math.max(0, c.spent_minor) : c.spent_minor;

/**
 * How far short of its plan an obligatory payment still counts as paid: paid in another currency than planned (rent
 * 500 $ sent in lari), the bank's rate and fee differ from the NBG's the plan is converted by.
 */
const PAID_TOLERANCE = 0.02;

/** An obligatory payment is paid: what was spent covers its plan, within PAID_TOLERANCE. One rule for every screen. */
export const isPaid = (spent: number, plan: number) => plan > 0 && spent >= plan * (1 - PAID_TOLERANCE);

/** What is left to pay of a payment: nothing once it is paid (isPaid), otherwise the plan less what was spent. */
export const leftToPay = (spent: number, plan: number) => (isPaid(spent, plan) ? 0 : Math.max(0, plan - spent));

export type StatGroup = {
  /** null: categories without a type, then "Без категории" */
  type_id: number | null;
  title: string;
  spent_minor: number;
  planned_minor: number;
  categories: CategoryStat[];
};

/** Sections for the stats list: types in their order, untyped categories last, uncategorized at the very end. */
export function groupByType(categories: CategoryStat[], types: Array<{ id: number; name: string }>): StatGroup[] {
  const groups: StatGroup[] = [];
  const add = (type_id: number | null, title: string, cats: CategoryStat[]) => {
    if (cats.length === 0) return;
    groups.push({
      type_id,
      title,
      categories: cats,
      spent_minor: cats.reduce((s, c) => s + spentOf(c), 0),
      planned_minor: cats.reduce((s, c) => s + (c.limit_minor ?? 0), 0),
    });
  };
  for (const t of types)
    add(
      t.id,
      t.name,
      categories.filter((c) => c.type_id === t.id),
    );
  add(
    null,
    'Без раздела',
    categories.filter((c) => c.type_id === null && c.category_id !== null),
  );
  add(
    null,
    'Без категории',
    categories.filter((c) => c.category_id === null),
  );
  return groups;
}

export type MonthStats = {
  ym: string;
  /** every amount below is in this currency */
  currency: Currency;
  groups: StatGroup[];
  spent_minor: number;
  planned_minor: number;
  categories: CategoryStat[];
  /** refunds without a category (no merchant category known): subtracted from spent_minor, ≥ 0 */
  refunds_unassigned_minor: number;
  /** spending that couldn't be converted yet (no rate known: offline), not in the totals */
  other_currencies: Array<{ currency: string; spent_minor: number }>;
  /** the funds ("Копилки"): their spending is taken from what they saved, not in the totals but their shortage */
  funds: FundStat[];
};

/** A fund in a month, in the stats' currency. */
export type FundStat = {
  category_id: number;
  name: string;
  emoji: string | null;
  color: string;
  /** spent from it this month */
  spent_minor: number;
  /** what it had for the month: saved at its start plus the month's contribution */
  available_minor: number;
  /** spent past what it had: the month's spending (over the plan) */
  shortage_minor: number;
  /** what is left in it (now, for the current month) */
  left_minor: number;
  /** the month's contribution */
  contribution_minor: number;
  target_minor: number;
  /** by when, 'YYYY-MM-DD' */
  due: string;
  /** a fund in another currency than the stats': what was spent from it and its shortage in its own, shown in the row */
  own: { currency: Currency; spent_minor: number; shortage_minor: number } | null;
};

/** Spending outside the plan: categories without a plan amount, and spending without a category (transfers too). */
export function unplannedSpent(stats: MonthStats): number {
  return stats.categories.filter((c) => c.limit_minor === null).reduce((a, c) => a + Math.max(0, c.spent_minor), 0);
}
