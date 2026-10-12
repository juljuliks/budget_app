// The operation's writes: each one tells the screens the data changed.
import { incrementCategoryUsage } from '@/db/categories';
import {
  addManualTransaction, DeletedTransaction, deleteTransactions, markTransactionSeen, markTransactionsSeen, restoreTransactions, setTransactionAmount, setTransactionNote,
} from '@/db/transactions';
import { getParts, splitTransaction, TxPart, unsplitTransactions } from '@/db/parts';
import { emitTransactionsChanged } from '@/domain/events';

export async function saveTransactionAmount(id: number, amountMinor: number, currency: string) {
  await setTransactionAmount(id, amountMinor, currency);
  emitTransactionsChanged();
}

/** "Разделить по категориям": `categoryId` gets what the `parts` (other categories) leave. */
export async function splitOperation(id: number, categoryId: number, parts: TxPart[]) {
  await splitTransaction(id, categoryId, parts);
  emitTransactionsChanged();
}

/** "Убрать разделение": the whole amount back in the operation's own category; the parts it had, to put back. */
export async function unsplitOperation(id: number): Promise<TxPart[]> {
  const parts = await getParts(id);
  await unsplitTransactions([id]);
  emitTransactionsChanged();
  return parts;
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

/** Deletes; what was deleted, to put back with `bringBackTransactions`. */
export async function removeTransactions(ids: number[]): Promise<DeletedTransaction[]> {
  const rows = await deleteTransactions(ids);
  emitTransactionsChanged();
  return rows;
}

/** "Отменить" after deleting: the operations as they were. */
export async function bringBackTransactions(rows: DeletedTransaction[]) {
  await restoreTransactions(rows);
  emitTransactionsChanged();
}

/** An operation added by hand (cash, or what the bank sent no SMS for); its category counts as used. */
export async function addTransaction(t: Parameters<typeof addManualTransaction>[0]) {
  await addManualTransaction(t);
  if (t.category_id !== null && t.category_id !== undefined) await incrementCategoryUsage(t.category_id);
  emitTransactionsChanged();
}
