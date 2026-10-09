// The operation's writes: each one tells the screens the data changed.
import { deleteTransaction, markTransactionSeen, setTransactionAmount, setTransactionNote } from '@/db/transactions';
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

export async function removeTransactions(ids: number[]) {
  for (const id of ids) await deleteTransaction(id);
  emitTransactionsChanged();
}
