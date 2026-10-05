import { Category, categoryLabel, countPastTransactionsOfCategory, deleteCategory } from '../db/categories';
import { emitTransactionsChanged } from '../events';
import { plural } from './format';
import { sheetAlert } from './sheetAlert';

/**
 * Deleting a category with no operations this month: a confirmation sheet, then the delete. Its plan of this month
 * and its merchants' categories go with it; past months keep it. `onDeleted` runs after (back to the categories).
 */
export async function confirmDeleteCategory(category: Category, onDeleted: () => void) {
  const past = await countPastTransactionsOfCategory(category.id);
  sheetAlert(
    `Удалить категорию «${categoryLabel(category)}»?`,
    'В этом месяце операций в ней нет. Вместе с ней удалятся её план на этот месяц и категория у мерчантов.'
      + (past > 0 ? ` Прошлые месяцы (${past} ${plural(past, ['операция', 'операции', 'операций'])}) останутся в этой категории и не изменятся.` : ''),
    [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить категорию', style: 'destructive', onPress: () => {
          deleteCategory(category.id, null).then(() => { emitTransactionsChanged(); onDeleted(); })
            .catch((e) => console.error('delete category failed', e));
        },
      },
    ]);
}
