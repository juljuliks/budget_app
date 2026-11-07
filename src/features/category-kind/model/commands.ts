// «В плане» saved: the category's kind (a limit or a one-off payment; a regular payment and a fund are saved by their setup).
import { CategoryPlanKind, categorySchedule, currentYm, getPlanItemBasics, lastPlanItem, setCategoryPlanKind, setPlanAmount } from '@/db/plans';
import { getCategory } from '@/db/categories';
import { categoryPayment } from '@/db/recurring';
import { emitTransactionsChanged } from '@/domain/events';
import { turnOffRecurring } from '@/entities/plan';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { toast, toastError } from '@/shared/ui/toast';
import { kindSaved } from '../texts';

export async function saveCategoryKind(categoryId: number, kind: CategoryPlanKind, label: string): Promise<boolean> {
  try {
    await setCategoryPlanKind(categoryId, kind);
    emitTransactionsChanged();
    toast(kindSaved(label));
    return true;
  } catch (e) {
    console.error('save category kind failed', e);
    toastError(SAVE_FAILED);
    return false;
  }
}

/** Its regular payments off when another kind is saved: asked if they saved something; false — kept, nothing saved. */
export async function leaveRegular(categoryId: number, recurring: boolean): Promise<boolean> {
  if (!recurring) return true;
  try {
    return await turnOffRecurring(categoryId);
  } catch (e) {
    console.error('turn off recurring failed', e);
    toastError(SAVE_FAILED);
    return false;
  }
}

/**
 * Its kind saved: is its amount there already (no plan's sheet asked)? A limit, a monthly payment — this month's, else
 * the latest month's put in this month as it was (past the budget — asked in the sheet); every day or week — its
 * amount each time; rarer than monthly, a fund — on the category. A one-off payment's is each month's own: asked.
 */
export async function keepLastAmount(categoryId: number): Promise<boolean> {
  const ym = currentYm();
  const [c, item, schedule, own] = await Promise.all([
    getCategory(categoryId), getPlanItemBasics(ym, categoryId), categorySchedule(categoryId), categoryPayment(categoryId)]);
  if (!c || c.plan_kind === 'fund') return true;
  if (c.plan_kind === 'oneoff' || c.plan_kind === null) return false;
  if (c.plan_kind === 'regular' && schedule) return schedule.unit_minor > 0;
  if (c.plan_kind === 'regular' && own && own.period > 1) return true;
  if (item && item.limit_minor > 0) return true;
  const last = await lastPlanItem(ym, categoryId);
  if (!last) return false;
  try {
    await setPlanAmount(ym, categoryId, last.limit_minor, item?.kind ?? (c.plan_kind === 'limit' ? 'limit' : 'fixed'), last.currency, last.norm_period);
  } catch (e) {
    console.error('keep last amount failed', e);
    return false;
  }
  emitTransactionsChanged();
  return true;
}
