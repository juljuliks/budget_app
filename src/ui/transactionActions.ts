import { sheetAlert } from './sheetAlert';
import { deleteTransaction } from '../db/transactions';
import { emitTransactionsChanged } from '../events';
import { formatAmount, merchantLabel } from './format';

/** "Удалить транзакцию?" confirmation; deletes and notifies the screens, then calls onDeleted. */
export function confirmDeleteTransaction(
  tx: { id: number; raw_merchant: string | null; amount_minor: number; currency: string; kind: string },
  onDeleted?: () => void,
) {
  sheetAlert('Удалить операцию?', `${merchantLabel(tx)}, ${formatAmount(tx.amount_minor, tx.currency, tx.kind)}`, [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          await deleteTransaction(tx.id);
          emitTransactionsChanged();
          onDeleted?.();
        } catch (e) {
          console.error('delete transaction failed', e);
        }
      },
    },
  ]);
}
