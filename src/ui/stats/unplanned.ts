import { Currency } from '../../db/fx';
import { CategoryStat, getPlanBudget, monthStats, parseYm, planConverter, StatGroup, unplannedOf, unplannedSpent } from '../../db/plans';

/**
 * "Вне плана" in the stats: the categories without a plan this month and the uncategorized spending leave their
 * type sections for one section at the bottom (as the plan's own "Вне плана"). `planned`: has a plan this month.
 */
export function splitUnplanned(groups: StatGroup[], planned: (c: CategoryStat) => boolean): { groups: StatGroup[]; unplanned: CategoryStat[]; spent: number } {
  const unplanned: CategoryStat[] = [];
  const kept: StatGroup[] = [];
  for (const g of groups) {
    const inPlan = g.categories.filter((c) => c.category_id !== null && planned(c));
    unplanned.push(...g.categories.filter((c) => !inPlan.includes(c)));
    if (inPlan.length === 0) continue;
    kept.push({
      ...g, categories: inPlan,
      spent_minor: inPlan.reduce((s, c) => s + c.spent_minor, 0),
      planned_minor: inPlan.reduce((s, c) => s + (c.limit_minor ?? 0), 0),
    });
  }
  unplanned.sort((a, b) => b.spent_minor - a.spent_minor);
  return { groups: kept, unplanned, spent: unplanned.reduce((s, c) => s + Math.max(0, c.spent_minor), 0) };
}

/** The month's share for spending outside the plan (0 without a budget), in `currency`. */
export async function unplannedShare(ym: string, currency: Currency): Promise<number> {
  const [budget, conv] = await Promise.all([getPlanBudget(ym), planConverter(ym)]);
  if (!budget) return 0;
  const share = unplannedOf(budget);
  return budget.currency === currency ? share : conv(share, budget.currency, currency) ?? share;
}

/**
 * For a day / week: the month the period ends in — which categories have a plan, the spending outside it so far and
 * the month's share for it.
 */
export async function unplannedMonth(ym: string, currency: Currency): Promise<{ planned: Set<number>; spent: number; share: number }> {
  const { year, month } = parseYm(ym);
  const [stats, share] = await Promise.all([monthStats(year, month, currency), unplannedShare(ym, currency)]);
  const planned = new Set(stats.categories.filter((c) => c.category_id !== null && c.limit_minor !== null).map((c) => c.category_id!));
  return { planned, spent: unplannedSpent(stats), share };
}
