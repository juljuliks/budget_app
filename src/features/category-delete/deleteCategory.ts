import { Category, categoryLabel, currentTransactionsOfCategory, deleteCategory, getCategory } from '@/db/categories';
import { categoryDeletePreview } from '@/db/categoryDeletion';
import { emitTransactionsChanged } from '@/events';
import { deleteEmptyText } from './texts';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { openCategoryDelete } from '@/shared/navigation/sheets';

/**
 * «Удалить категорию»: with operations this month — the sheet that moves them first (`close` closes the category's
 * sheet before it); without — a confirmation, then `close` and `onDeleted`.
 */
export async function startCategoryDelete(categoryId: number, { close, onDeleted }: { close: () => void; onDeleted: () => void }) {
  const [c, current] = await Promise.all([getCategory(categoryId), currentTransactionsOfCategory(categoryId)]);
  if (!c) return;
  if (current.length > 0) { close(); openCategoryDelete(c.id); return; }
  confirmDeleteCategory(c, () => { close(); onDeleted(); });
}

/** Deletes the category, its operations of this month moved to `target` (null: left without a category). */
export async function removeCategory(categoryId: number, target: number | null) {
  await deleteCategory(categoryId, target);
  emitTransactionsChanged();
}

/**
 * Deleting a category with no operations this month: a confirmation sheet (what stays in the past, which merchants
 * lose it, its plan), then the delete. `onDeleted` runs after (back to the categories).
 */
export async function confirmDeleteCategory(category: Category, onDeleted: () => void) {
  const label = categoryLabel(category);
  const t = deleteEmptyText(label, await categoryDeletePreview(category.id));
  sheetAlert(t.title, t.message, [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Удалить', style: 'destructive', onPress: () => {
        removeCategory(category.id, null).then(() => {
          toast(`Категория «${label}» удалена`);
          onDeleted();
        })
          .catch((e) => { console.error('delete category failed', e); toastError('Не удалось удалить'); });
      },
    },
  ]);
}
