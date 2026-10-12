// The templates' writes: each one tells the screens the data changed.
import { deleteTemplates } from '@/db/messages';
import { emitTransactionsChanged } from '@/domain/events';

/** One template removed (null: all, "Сбросить все шаблоны"): the operations they made stay. */
export async function removeTemplates(id: number | null) {
  await deleteTemplates(id);
  emitTransactionsChanged();
}
