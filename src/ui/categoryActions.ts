import { Category, categoryLabel, deleteCategory } from '../db/categories';
import { categoryDeletePreview } from '../db/categoryDeletion';
import { emitTransactionsChanged } from '../events';
import { deleteEmptyText } from './categoryDeletionText';
import { sheetAlert } from './sheetAlert';
import { toast, toastError } from './toast';

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
        deleteCategory(category.id, null).then(() => {
          emitTransactionsChanged();
          toast(`Категория «${label}» удалена`);
          onDeleted();
        })
          .catch((e) => { console.error('delete category failed', e); toastError('Не удалось удалить'); });
      },
    },
  ]);
}
