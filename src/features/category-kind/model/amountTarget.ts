// The plan's sheet opened on a category's page once its kind is saved: this month's amount of it, where it is the plan's.
import type { Currency } from '@/db/fx';
import { getCategory } from '@/db/categories';
import { categorySchedule, currentYm, getPlanItemBasics } from '@/db/plans';
import { categoryPayment } from '@/db/recurring';
import type { PlanAmountTarget } from '@/entities/plan';

/**
 * This month's item of the category for the plan's sheet (not in the plan — a new one, the sheet offers last month's);
 * null — its amount isn't the plan's: a fund, a regular payment rarer than monthly (asked on its page).
 */
export async function amountTargetOf(categoryId: number, label: string, shown: Currency): Promise<PlanAmountTarget | null> {
  const [c, item, schedule, own] = await Promise.all([
    getCategory(categoryId), getPlanItemBasics(currentYm(), categoryId), categorySchedule(categoryId), categoryPayment(categoryId)]);
  if (!c || c.plan_kind === 'fund') return null;
  if (c.plan_kind === 'regular' && !schedule && own && own.period > 1) return null;
  return item ? { category_id: categoryId, label, ...item } : { category_id: categoryId, label, limit_minor: 0, currency: shown };
}
