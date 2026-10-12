// Changing operations: category, amount, note, read, deleted, added by hand.
import { getDb } from '../index';
import type { Db, SqlParam } from '../types';
import { CategorySource } from './rows';
import { placeholders } from '../sql';
import { fitParts, getParts, moveParts, TxPart, unsplitTransactions } from '../parts';

/**
 * Bulk "change category" from the list: a manual choice ("Без категории" too), so no merchant rules are created. A split
 * operation goes whole into it — but sorting out a category being deleted (`from`), only what is in that one moves: the
 * operations in it, a split one's part in it.
 */
export async function setCategoryForTransactions(txIds: number[], categoryId: number | null, db?: Db, from?: number) {
  if (txIds.length === 0) return;
  db ??= await getDb();
  const marks = placeholders(txIds.length);
  if (from === undefined) await unsplitTransactions(txIds, db);
  else await moveParts(db, [from], categoryId, `t.id IN (${marks})`, txIds);
  await db.run(
    `UPDATE transactions SET category_id = ?, category_source = ? WHERE id IN (${marks})${from === undefined ? '' : ' AND category_id = ?'}`,
    [categoryId, 'user', ...txIds, ...(from === undefined ? [] : [from])]);
}

/**
 * Corrects a transaction's amount and currency (e.g. the SMS was wrong or a manual entry was mistyped); a split one's
 * parts follow (fitParts).
 */
export async function setTransactionAmount(id: number, amountMinor: number, currency: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const before = await tx.get<{ amount_minor: number; currency: string }>('SELECT amount_minor, currency FROM transactions WHERE id = ?', [id]);
    await tx.run('UPDATE transactions SET amount_minor = ?, currency = ? WHERE id = ?', [amountMinor, currency, id]);
    if (before) await fitParts(tx, id, before);
  });
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

/** A deleted operation's whole row and its parts (a split one), to put it back as it was ("Отменить" in the toast). */
export type DeletedTransaction = { row: Record<string, SqlParam>; parts: TxPart[] };

/** Deletes these operations in one go; their rows, for restoreTransactions. */
export async function deleteTransactions(ids: number[]): Promise<DeletedTransaction[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.transaction(async (t) => {
    const rows = await t.all<Record<string, SqlParam>>(`SELECT * FROM transactions WHERE id IN (${placeholders(ids.length)})`, ids);
    const deleted: DeletedTransaction[] = [];
    for (const row of rows) deleted.push({ row, parts: await getParts(row.id as number, t) });
    await t.run(`DELETE FROM transactions WHERE id IN (${placeholders(ids.length)})`, ids);
    return deleted;
  });
}

/**
 * Puts deleted operations back with their ids (a refund's link to its purchase holds). One that came again meanwhile
 * (the same SMS imported) is left as it is.
 */
export async function restoreTransactions(deleted: DeletedTransaction[]) {
  if (deleted.length === 0) return;
  const db = await getDb();
  await db.transaction(async (t) => {
    for (const { row, parts } of deleted) {
      const cols = Object.keys(row);
      const { changes } = await t.run(`INSERT OR IGNORE INTO transactions (${cols.join(', ')}) VALUES (${placeholders(cols.length)})`, cols.map((c) => row[c]));
      if (changes === 0) continue;
      for (const p of parts) {
        await t.run('INSERT INTO transaction_parts (tx_id, category_id, amount_minor) VALUES (?, ?, ?)', [row.id, p.category_id, p.amount_minor]);
      }
    }
  });
}

/**
 * categoryId = null clears the category. "Без категории" picked by the user keeps source 'user', so a merchant
 * category never fills it in later; an untouched uncategorized transaction has no source.
 */
export async function setTransactionCategory(txId: number, categoryId: number | null, source: CategorySource, db?: Db) {
  db ??= await getDb();
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
      (bank, kind, amount_minor, currency, note, category_id, category_source, occurred_at, raw_sms, sms_hash, seen_at)
      VALUES ('manual', ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
    [tx.kind ?? 'purchase', tx.amount_minor, tx.currency ?? 'GEL', description, tx.category_id,
     tx.category_id === null ? null : 'user', occurredAt, `manual:${now}:${Math.random().toString(36).slice(2)}`,
     // entered by the user, so already "seen"
     Math.floor(now / 1000)]);
  return lastInsertRowid;
}
