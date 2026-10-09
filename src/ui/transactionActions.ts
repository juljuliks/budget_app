import { sheetAlert } from '@/shared/ui/sheetAlert';
import { deleteTransaction } from '../db/transactions';
import { emitTransactionsChanged } from '../events';
import { formatAmount, merchantLabel, plural } from '@/shared/lib/format';
import { toast, toastError } from '@/shared/ui/toast';

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
          toast('Операция удалена');
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
    'Они пропадут из истории и статистики. Отменить это нельзя.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: `Удалить (${n})`, style: 'destructive', onPress: async () => {
          try {
            for (const t of txs) await deleteTransaction(t.id);
            emitTransactionsChanged();
            toast(`Удалено операций: ${n}`);
            onDeleted?.();
          } catch (e) {
            console.error('delete transactions failed', e);
            toastError('Не удалось удалить');
          }
        },
      },
    ]);
}
