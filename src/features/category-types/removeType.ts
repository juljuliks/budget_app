import { deleteCategoryType } from '@/db/categoryTypes';
import { emitTransactionsChanged } from '@/events';

/** Deletes the section: its categories stay, without one. */
export async function removeCategoryType(typeId: number) {
  await deleteCategoryType(typeId);
  emitTransactionsChanged();
}
