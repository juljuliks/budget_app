import { getDb } from './index';
import { Currency, dateKey, ensureRates, makeConverter } from './fx';
import { getPlanBudget, monthRange, monthStats, parseYm, planConverter, unplannedOf, unplannedSpent, ymOf } from './plans';

// The month's report (the notification on the 1st, «История», the stats of a past month): what was put aside and what
// kept more from being put aside — limits overspent, spending outside the plan past its share — and what that is a year.

/** "Пересмотрите" spending outside the plan: more than this share of all spending, … */
export const REVIEW_SHARE_OF_SPENDING = 0.25;
/** … or its share of the budget exceeded by more than this */
export const REVIEW_SHARE_EXCEEDED = 0.2;
/** an overspend under this share of its plan is noise (a rate change, a tip): not in the report */
export const OVER_TOLERANCE = 0.05;
/** the months the year's estimate averages */
export const AVERAGE_MONTHS = 3;
/** a month "has data" when its first operation is on this day or earlier (not a month the app was installed late in) */
const DATA_FROM_DAY = 15;
/** the biggest categories outside the plan offered to plan */
const TOP_UNPLANNED = 3;

export type ReportCategory = { id: number | null; name: string; emoji: string | null; spent: number; limit: number };

export type MonthReport = {
  ym: string;
  currency: Currency;
  /** null without a budget for the month */
  budget: number | null;
  spent: number;
  /** budget − spending; null without a budget */
  saved: number | null;
  /** the previous month's, to compare; null without one (no budget, or too few operations to compare) */
  previousSaved: number | null;
  /** put aside on average over the latest months with data (this one included, up to AVERAGE_MONTHS): the year's estimate */
  average: { saved: number; months: Array<{ ym: string; saved: number }> } | null;
  /** the month has operations from its first half on: comparisons and "не оплачены" make sense */
  hasData: boolean;
  /** categories over their plan: spent − plan each */
  overLimits: ReportCategory[];
  overLimitsTotal: number;
  /** the share of the budget for spending outside the plan, and what was spent outside it */
  unplannedShare: number;
  unplannedSpent: number;
  /** spending outside the plan past its share (0 within it) */
  unplannedOver: number;
  /** what could have been put aside on top: the overspend of limits + spending outside the plan past its share */
  couldSaveMore: number;
  /** spending outside the plan of all spending, 0..1 */
  unplannedOfSpending: number;
  /** spending outside the plan is a lot: worth planning its biggest categories */
  review: boolean;
  topUnplanned: ReportCategory[];
  /** operations without a category: to sort out */
  uncategorizedCount: number;
  /** flexible categories that spent less than planned, together */
  savedInPlan: number;
  /** those categories, the biggest saving first */
  underPlan: ReportCategory[];
  /** obligatory payments with nothing paid this month */
  unpaid: ReportCategory[];
  /** operations in "Сбережения" this month: money moved to savings by hand (part of `saved`, not on top of it) */
  movedToSavings: number;
  /** the leftover goes to "Сбережения" (the budget's switch) */
  toSavings: boolean;
  /**
   * Where `saved` comes from, exactly (they add up to it): what the plan left undistributed, what the planned categories
   * didn't spend (minus their overspend), and what is left of the share outside the plan (minus spending past it).
   * null without a budget.
   */
  savedFrom: { locked: number; undistributed: number; plan: number; unplanned: number } | null;
  /** locked for savings (🔒) this month, in `currency`; 0 without a lock */
  locked: number;
  /** spending went into the locked savings by this much (spent more than budget − locked); 0 when untouched */
  lockedTouched: number;
};

/** "≈ 14 400 ₾ за год" in this pace */
export const yearly = (monthly: number) => monthly * 12;

const previousYm = (ym: string) => {
  const { year, month } = parseYm(ym);
  return month === 0 ? ymOf(year - 1, 11) : ymOf(year, month - 1);
};

/** What was put aside in `ym` (budget − spending), in `currency`; null without a budget. */
async function savedIn(ym: string, currency: Currency): Promise<{ budget: number | null; saved: number | null; stats: Awaited<ReturnType<typeof monthStats>> }> {
  const { year, month } = parseYm(ym);
  const [stats, budget, conv] = await Promise.all([monthStats(year, month, currency), getPlanBudget(ym), planConverter(ym)]);
  const amount = budget ? conv(budget.amount_minor, budget.currency, currency) : null;
  return { budget: amount, saved: amount === null ? null : amount - stats.spent_minor, stats };
}

/** Whether `ym` has operations from its first half on (DATA_FROM_DAY). */
async function hasDataIn(ym: string): Promise<boolean> {
  const { year, month } = parseYm(ym);
  const [from, to] = monthRange(year, month);
  const db = await getDb();
  const first = (await db.get<{ at: number | null }>('SELECT min(occurred_at) AS at FROM transactions WHERE occurred_at >= ? AND occurred_at < ?', [from, to]))?.at;
  return first != null && new Date(first * 1000).getDate() <= DATA_FROM_DAY;
}

export async function monthReport(ym: string, currency: Currency): Promise<MonthReport> {
  const prevYm = previousYm(ym);
  const [{ budget, saved, stats }, previous, planBudget, conv, hasData, previousHasData] = await Promise.all([
    savedIn(ym, currency), savedIn(prevYm, currency), getPlanBudget(ym), planConverter(ym), hasDataIn(ym), hasDataIn(prevYm)]);
  // the year's estimate: the average of this month and the ones before it that have a budget and data
  const months: Array<{ ym: string; saved: number }> = [];
  if (saved !== null && hasData) months.push({ ym, saved });
  if (previous.saved !== null && previousHasData) months.push({ ym: prevYm, saved: previous.saved });
  const third = previousYm(prevYm);
  if (months.length === 2) {
    const [t, tData] = await Promise.all([savedIn(third, currency), hasDataIn(third)]);
    if (t.saved !== null && tData) months.push({ ym: third, saved: t.saved });
  }
  const cat = (c: typeof stats.categories[number]): ReportCategory => ({
    id: c.category_id, name: c.name, emoji: c.emoji, spent: c.spent_minor, limit: c.limit_minor ?? 0,
  });

  const overLimits = stats.categories.filter((c) => c.limit_minor !== null && c.spent_minor > c.limit_minor * (1 + OVER_TOLERANCE))
    .map(cat).sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit));
  const overLimitsTotal = overLimits.reduce((a, c) => a + c.spent - c.limit, 0);

  const share = planBudget ? conv(unplannedOf(planBudget), planBudget.currency, currency) ?? 0 : 0;
  const locked = planBudget ? conv(planBudget.locked_minor, planBudget.currency, currency) ?? 0 : 0;
  const outside = unplannedSpent(stats);
  // within 5% of the share: not an overspend either
  const unplannedOver = outside > share * (1 + OVER_TOLERANCE) ? outside - share : 0;
  const unplannedOfSpending = stats.spent_minor > 0 ? outside / stats.spent_minor : 0;

  const { year, month } = parseYm(ym);
  const [from, to] = monthRange(year, month);
  const db = await getDb();
  const uncategorizedCount = (await db.get<{ n: number }>(
    `SELECT count(*) AS n FROM transactions WHERE occurred_at >= ? AND occurred_at < ? AND category_id IS NULL
      AND kind IN ('purchase', 'payment', 'withdrawal', 'transfer')`, [from, to]))?.n ?? 0;

  const underPlan = stats.categories.filter((c) => c.plan_kind === 'limit' && c.limit_minor !== null && c.spent_minor < c.limit_minor)
    .map(cat).sort((a, b) => (b.limit - b.spent) - (a.limit - a.spent));

  // operations in "Сбережения", each on its day's rate
  const moved = await db.all<{ amount_minor: number; currency: string; occurred_at: number }>(
    `SELECT amount_minor, currency, occurred_at FROM transactions
      WHERE occurred_at >= ? AND occurred_at < ? AND kind != 'refund' AND kind != 'deposit'
        AND category_id = (SELECT id FROM categories WHERE system = 'savings')`, [from, to]);
  await ensureRates(moved.filter((m) => m.currency !== currency).map((m) => dateKey(m.occurred_at)));
  const fx = await makeConverter();
  const movedToSavings = moved.reduce((a, m) => a + (fx(m.amount_minor, m.currency, currency, dateKey(m.occurred_at)) ?? 0), 0);

  return {
    ym, currency, budget, spent: stats.spent_minor, saved,
    previousSaved: hasData && previousHasData ? previous.saved : null,
    average: months.length ? { saved: months.reduce((a, m) => a + m.saved, 0) / months.length, months } : null,
    hasData,
    overLimits, overLimitsTotal,
    unplannedShare: share, unplannedSpent: outside, unplannedOver,
    couldSaveMore: overLimitsTotal + unplannedOver,
    unplannedOfSpending,
    review: outside > 0 && (unplannedOfSpending > REVIEW_SHARE_OF_SPENDING || (share > 0 && outside > share * (1 + REVIEW_SHARE_EXCEEDED))),
    topUnplanned: stats.categories.filter((c) => c.limit_minor === null && c.category_id !== null && !c.deleted && c.spent_minor > 0)
      .slice(0, TOP_UNPLANNED).map(cat),
    uncategorizedCount,
    savedInPlan: underPlan.reduce((a, c) => a + c.limit - c.spent, 0),
    underPlan,
    // without data for the month a payment may just not be in the app yet
    unpaid: hasData ? stats.categories.filter((c) => c.plan_kind === 'fixed' && c.spent_minor <= 0).map(cat) : [],
    movedToSavings,
    toSavings: planBudget?.to_savings ?? true,
    locked,
    lockedTouched: budget === null || locked <= 0 ? 0 : Math.max(0, stats.spent_minor - (budget - locked)),
    savedFrom: budget === null ? null : {
      locked,
      undistributed: budget - stats.planned_minor - share - locked,
      plan: stats.categories.filter((c) => c.limit_minor !== null).reduce((a, c) => a + c.limit_minor! - c.spent_minor, 0),
      unplanned: share - outside,
    },
  };
}
