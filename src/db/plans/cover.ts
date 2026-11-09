// The spending outside the plan past its share, covered by a cut of the plan ("Покрыть перерасход"): what is added to
// the share this month only (it doesn't carry over to the next one), in the budget's currency.
import { getDb } from '../index';
import { getPlanBudget, ownMonth, planConverter, unplannedOf } from './budget';
import { setPlanAmount } from './items';
import { asCurrency, parseYm } from './months';
import { monthStats, unplannedSpent } from './stats';

/** By how much the spending outside the plan is past its share, in the budget's currency; 0 — not past it, no budget. */
export async function unplannedOver(ym: string): Promise<number> {
  const budget = await getPlanBudget(ym);
  if (!budget) return 0;
  const { year, month } = parseYm(ym);
  const stats = await monthStats(year, month, budget.currency);
  return Math.max(0, unplannedSpent(stats) - unplannedOf(budget));
}

/** Adds `minor` to what the month covered of it (negative — "Отменить"; never below 0). */
export async function addUnplannedCover(ym: string, minor: number): Promise<void> {
  const db = await getDb();
  await db.transaction(async (t) => {
    await ownMonth(ym, t);
    await t.run('UPDATE plan_months SET unplanned_cover_minor = max(0, unplanned_cover_minor + ?) WHERE ym = ?', [minor, ym]);
  });
}

/**
 * "Покрыть из плана": up to `minor` (the budget's currency) off a limit of the month, onto the share — never past what is
 * left of it in its own currency (its spending there by the days' rates, not the plan's). What was covered and the
 * limit before ("Отменить"); null — nothing left of it.
 */
export async function coverFromLimit(ym: string, categoryId: number, minor: number): Promise<{ covered: number; was: number } | null> {
  const db = await getDb();
  const [budget, conv, item] = await Promise.all([
    getPlanBudget(ym), planConverter(ym),
    db.get<{ limit_minor: number; currency: string }>('SELECT limit_minor, currency FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]),
  ]);
  if (!budget || !item) return null;
  const { year, month } = parseYm(ym);
  const stats = await monthStats(year, month, asCurrency(item.currency));
  const spent = stats.categories.find((c) => c.category_id === categoryId)?.spent_minor ?? 0;
  const want = conv(minor, budget.currency, item.currency) ?? 0;
  const take = Math.min(item.limit_minor - Math.max(0, spent), want);
  if (take <= 0) return null;
  const covered = take === want ? minor : conv(take, item.currency, budget.currency) ?? 0;
  await setPlanAmount(ym, categoryId, item.limit_minor - take);
  await addUnplannedCover(ym, covered);
  return { covered, was: item.limit_minor };
}
