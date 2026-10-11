// Changing operations: category, amount, note, read, deleted, added by hand.
import { getDb } from '../index';
import { CategorySource } from './rows';
import { placeholders } from '../sql';

/** Bulk "change category" from the list: a manual choice ("Без категории" too), so no merchant rules are created. */
export async function setCategoryForTransactions(txIds: number[], categoryId: number | null) {
  if (txIds.length === 0) return;
  const db = await getDb();
  await db.run(
    `UPDATE transactions SET category_id = ?, category_source = ? WHERE id IN (${placeholders(txIds.length)})`,
    [categoryId, 'user', ...txIds]);
}

/** Corrects a transaction's amount and currency (e.g. the SMS was wrong or a manual entry was mistyped). */
export async function setTransactionAmount(id: number, amountMinor: number, currency: string) {
  const db = await getDb();
  await db.run('UPDATE transactions SET amount_minor = ?, currency = ? WHERE id = ?', [amountMinor, currency, id]);
}

/** Free-text note shown under the SMS; empty clears it. */
export async function setTransactionNote(id: number, note: string) {
  const db = await getDb();
  await db.run('UPDATE transactions SET note = ?, search_text = NULL WHERE id = ?', [note.trim() || null, id]);
}

/** Opening a transaction marks it read. Returns true if it was unread. */
export async function markTransactionSeen(id: number): Promise<boolean> {
  const db = await getDb();
  const { changes } = await db.run(
    'UPDATE transactions SET seen_at = ? WHERE id = ? AND seen_at IS NULL', [Math.floor(Date.now() / 1000), id]);
  return changes > 0;
}

/** "Прочитать (N)" in edit mode: the selected transactions are marked read. */
export async function markTransactionsSeen(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const { changes } = await db.run(
    `UPDATE transactions SET seen_at = ? WHERE seen_at IS NULL AND id IN (${placeholders(ids.length)})`,
    [Math.floor(Date.now() / 1000), ...ids]);
  return changes;
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  await db.run('DELETE FROM transactions WHERE id = ?', [id]);
}

/**
 * categoryId = null clears the category. "Без категории" picked by the user keeps source 'user', so a merchant
 * category never fills it in later; an untouched uncategorized transaction has no source.
 */
export async function setTransactionCategory(txId: number, categoryId: number | null, source: CategorySource) {
  const db = await getDb();
  return db.run('UPDATE transactions SET category_id = ?, category_source = ? WHERE id = ?',
    [categoryId, source, txId]);
}

/** Manually entered transaction (cash etc.). Stored like an SMS one, with a unique synthetic hash. */
export async function addManualTransaction(tx: {
  amount_minor: number;
  currency?: string;
  kind?: 'purchase' | 'refund' | 'deposit' | 'transfer' | 'withdrawal';
  description?: string;
  category_id: number | null;
  occurred_at?: number; // unix seconds, default now
}): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const occurredAt = tx.occurred_at ?? Math.floor(now / 1000);
  const description = tx.description?.trim() || null;
  const { lastInsertRowid } = await db.run(
    `INSERT INTO transactions
      (bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, category_source, occurred_at, raw_sms, sms_hash, seen_at)
      VALUES ('manual', ?, ?, ?, ?, NULL, ?, ?, ?, '', ?, ?)`,
    [tx.kind ?? 'purchase', tx.amount_minor, tx.currency ?? 'GEL', description, tx.category_id,
     tx.category_id === null ? null : 'user', occurredAt, `manual:${now}:${Math.random().toString(36).slice(2)}`,
     // entered by the user, so already "seen"
     Math.floor(now / 1000)]);
  return lastInsertRowid;
}
