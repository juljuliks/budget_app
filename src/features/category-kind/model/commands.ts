// «В плане» saved: the category's kind (a limit or a one-off payment; a regular payment and a fund are saved by their setup).
import { CategoryPlanKind, setCategoryPlanKind } from '@/db/plans';
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
