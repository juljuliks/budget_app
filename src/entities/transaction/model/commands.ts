// The operation's writes: each one tells the screens the data changed.
import { incrementCategoryUsage } from '@/db/categories';
import { addManualTransaction, deleteTransaction, markTransactionSeen, markTransactionsSeen, setTransactionAmount, setTransactionNote } from '@/db/transactions';
import { emitTransactionsChanged } from '@/events';

export async function saveTransactionAmount(id: number, amountMinor: number, currency: string) {
  await setTransactionAmount(id, amountMinor, currency);
  emitTransactionsChanged();
}

/** An empty note removes it. */
export async function saveTransactionNote(id: number, note: string) {
  await setTransactionNote(id, note);
  emitTransactionsChanged();
}

/** Opened: no longer unread (the list's dot, the tab's badge). */
export async function markSeen(id: number) {
  if (await markTransactionSeen(id)) emitTransactionsChanged();
}

/** Several read at once (the selection's "Отметить просмотренными"). */
export async function markAllSeen(ids: number[]) {
  await markTransactionsSeen(ids);
  emitTransactionsChanged();
}

export async function removeTransactions(ids: number[]) {
  for (const id of ids) await deleteTransaction(id);
  emitTransactionsChanged();
}

/** An operation added by hand (cash, or what the bank sent no SMS for); its category counts as used. */
export async function addTransaction(t: Parameters<typeof addManualTransaction>[0]) {
  await addManualTransaction(t);
  if (t.category_id !== null && t.category_id !== undefined) await incrementCategoryUsage(t.category_id);
  emitTransactionsChanged();
}
