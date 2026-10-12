import { sheetAlert } from '@/shared/ui/sheetAlert';
import type { DeletedTransaction } from '@/db/transactions';
import { UNDO } from '@/shared/lib/strings';
import { bringBackTransactions, removeTransactions } from './commands';
import { formatAmount, plural } from '@/shared/lib/format';
import { merchantLabel } from './title';
import { toast, toastError, toastFailure } from '@/shared/ui/toast';

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
          undoToast('Операция удалена', await removeTransactions([tx.id]));
          onDeleted?.();
        } catch (e) {
          console.error('delete transaction failed', e);
          toastError('Не удалось удалить');
        }
      },
    },
  ]);
}

/** "Удалить операции (N)?" for several selected ones; deletes them and notifies the screens, then calls onDeleted. */
export function confirmDeleteTransactions(
  txs: Array<{ id: number; amount_minor: number; currency: string; kind: string }>,
  onDeleted?: () => void,
) {
  const n = txs.length;
  sheetAlert(`Удалить ${n} ${plural(n, ['операцию', 'операции', 'операций'])}?`,
    'Они пропадут из истории и статистики.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: `Удалить (${n})`, style: 'destructive', onPress: async () => {
          try {
            undoToast(`Удалено операций: ${n}`, await removeTransactions(txs.map((t) => t.id)));
            onDeleted?.();
          } catch (e) {
            console.error('delete transactions failed', e);
            toastError('Не удалось удалить');
          }
        },
      },
    ]);
}

/** What was deleted, with "Отменить": the operations come back as they were. */
function undoToast(message: string, rows: DeletedTransaction[]) {
  toast(message, {
    label: UNDO,
    onPress: () => {
      bringBackTransactions(rows)
        .then(() => toast(rows.length === 1 ? 'Операция восстановлена' : `Восстановлено операций: ${rows.length}`))
        .catch(toastFailure('restore transactions', 'Не удалось восстановить'));
    },
  });
}
