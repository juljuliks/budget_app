import { txCategoryLabel } from '@/db/categories';
import type { TransactionRow } from '@/db/transactions';
import { UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastFailure } from '@/shared/ui/toast';
import { splitOperation, unsplitOperation } from './commands';

type Split = Pick<TransactionRow, 'id' | 'category_id' | 'category_name' | 'category_emoji' | 'category_type_name'>;

/** "Убрать разделение?": the whole amount back in the operation's own category; "Отменить" in the toast puts the parts back. */
export function confirmUnsplit(tx: Split) {
  const own = tx.category_id;
  sheetAlert('Убрать разделение?', `Вся сумма вернётся в «${txCategoryLabel(tx) ?? ''}».`, [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Убрать', onPress: () => {
        unsplitOperation(tx.id)
          .then((parts) => toast('Разделение убрано', {
            label: UNDO,
            onPress: () => {
              if (own === null) return;
              splitOperation(tx.id, own, parts).catch(toastFailure('split transaction', 'Не удалось вернуть разделение'));
            },
          }))
          .catch(toastFailure('unsplit transaction', 'Не удалось убрать разделение'));
      },
    },
  ]);
}
