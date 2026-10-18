// The category's writes: each one tells the screens the data changed.
import { RecurringUndo, turnRecurring, undoRecurring } from '@/db/subscriptions';
import { createCategory, updateCategory } from '@/db/categories';
import { createCategoryType, renameCategoryType, setCategoryTypePalette } from '@/db/categoryTypes';
import { emitTransactionsChanged } from '@/domain/events';

/** `recurring`: "Повторяющиеся платежи" */
export type CategoryFields = { name: string; emoji: string; typeId: number | null; color: string | null; recurring: boolean };

/**
 * Creates the category (no `id`) or saves it; its id, and how to put "Повторяющиеся платежи" back if they were turned
 * off (what they saved went to this month's savings).
 */
export async function saveCategory(id: number | undefined, v: CategoryFields, wasRecurring = false): Promise<{ id: number; undo: RecurringUndo | null }> {
  const saved = id ?? await createCategory(v.name, v.emoji, v.typeId, v.color);
  if (id !== undefined) await updateCategory(id, { name: v.name, emoji: v.emoji, typeId: v.typeId, color: v.color });
  const undo = v.recurring !== wasRecurring ? await turnRecurring(saved, v.recurring) : null;
  emitTransactionsChanged();
  return { id: saved, undo };
}

/** "Отменить" after "Повторяющиеся платежи" were turned off. */
export async function undoTurnOff(undo: RecurringUndo): Promise<void> {
  await undoRecurring(undo);
  emitTransactionsChanged();
}

/** Creates the section (no `id`) or renames it, with its palette; its id. */
export async function saveCategoryType(id: number | undefined, name: string, palette: string): Promise<number> {
  const saved = id ?? await createCategoryType(name);
  if (id !== undefined) await renameCategoryType(id, name);
  await setCategoryTypePalette(saved, palette);
  emitTransactionsChanged();
  return saved;
}
