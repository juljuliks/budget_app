// An operation split between categories ("Разделить по категориям"): its own category (transactions.category_id) gets
// what the parts in other categories leave. The table, its triggers and spend_parts (the spending by parts) —
// migration 33.
import { getDb } from './index';
import type { Db } from './types';
import { placeholders } from './sql';

/** A part in another category than the operation's own; amount in the operation's currency. */
export type TxPart = { category_id: number; amount_minor: number };

/** The parts of an operation, the biggest first. */
export async function getParts(txId: number, db?: Db): Promise<TxPart[]> {
  db ??= await getDb();
  return db.all<TxPart>(
    'SELECT category_id, amount_minor FROM transaction_parts WHERE tx_id = ? ORDER BY amount_minor DESC, category_id', [txId]);
}

/**
 * Splits an operation: `categoryId` (its own category) gets the rest, `parts` the other categories. A hand-made choice,
 * so a merchant category never re-files it. Throws when the parts leave nothing for its own category.
 */
export async function splitTransaction(txId: number, categoryId: number, parts: TxPart[]) {
  const db = await getDb();
  const merged = new Map<number, number>();
  for (const p of parts) {
    if (p.category_id !== categoryId && p.amount_minor > 0) merged.set(p.category_id, (merged.get(p.category_id) ?? 0) + p.amount_minor);
  }
  await db.transaction(async (tx) => {
    const row = await tx.get<{ amount_minor: number }>('SELECT amount_minor FROM transactions WHERE id = ?', [txId]);
    const sum = [...merged.values()].reduce((a, v) => a + v, 0);
    if (!row || sum >= row.amount_minor) throw new Error('the parts leave nothing for the operation\'s own category');
    await tx.run("UPDATE transactions SET category_id = ?, category_source = 'user' WHERE id = ?", [categoryId, txId]);
    await tx.run('DELETE FROM transaction_parts WHERE tx_id = ?', [txId]);
    for (const [c, a] of merged) {
      await tx.run('INSERT INTO transaction_parts (tx_id, category_id, amount_minor) VALUES (?, ?, ?)', [txId, c, a]);
    }
  });
}

/** How many of these operations are split. */
export async function countSplit(txIds: number[]): Promise<number> {
  if (txIds.length === 0) return 0;
  const db = await getDb();
  return (await db.get<{ n: number }>(
    `SELECT count(DISTINCT tx_id) AS n FROM transaction_parts WHERE tx_id IN (${placeholders(txIds.length)})`, txIds))!.n;
}

/** "Убрать разделение": the whole amount back in the operation's own category. */
export async function unsplitTransactions(txIds: number[], db?: Db) {
  if (txIds.length === 0) return;
  db ??= await getDb();
  await db.run(`DELETE FROM transaction_parts WHERE tx_id IN (${placeholders(txIds.length)})`, txIds);
}

/**
 * The amount (or currency) changed from `before`: while the own category keeps something, it takes the difference;
 * otherwise (and on a new currency) every part shrinks in proportion, so it keeps a share. Inside the caller's transaction.
 */
export async function fitParts(db: Db, txId: number, before: { amount_minor: number; currency: string }) {
  const parts = await getParts(txId, db);
  if (parts.length === 0) return;
  const now = await db.get<{ amount_minor: number; currency: string }>('SELECT amount_minor, currency FROM transactions WHERE id = ?', [txId]);
  if (!now) return;
  const sum = parts.reduce((a, p) => a + p.amount_minor, 0);
  if (now.currency === before.currency && sum < now.amount_minor) return;
  for (const p of parts) {
    const scaled = Math.floor((p.amount_minor * now.amount_minor) / before.amount_minor);
    if (scaled > 0) await db.run('UPDATE transaction_parts SET amount_minor = ? WHERE tx_id = ? AND category_id = ?', [scaled, txId, p.category_id]);
    else await db.run('DELETE FROM transaction_parts WHERE tx_id = ? AND category_id = ?', [txId, p.category_id]);
  }
}

/**
 * The parts in `fromIds` move to `toId`, adding up with a part already there; to the operation's own category or to
 * none (`null`), they merge back into it. `txWhere` (on `t`, the transactions) narrows which operations' parts.
 */
export async function moveParts(db: Db, fromIds: number[], toId: number | null, txWhere = '1', txParams: Array<number | string> = []) {
  if (fromIds.length === 0) return;
  const moved = await db.all<{ tx_id: number; own: number | null; amount: number }>(
    `SELECT p.tx_id, t.category_id AS own, sum(p.amount_minor) AS amount FROM transaction_parts p JOIN transactions t ON t.id = p.tx_id
      WHERE p.category_id IN (${placeholders(fromIds.length)}) AND ${txWhere} GROUP BY p.tx_id`, [...fromIds, ...txParams]);
  for (const m of moved) {
    await db.run(`DELETE FROM transaction_parts WHERE tx_id = ? AND category_id IN (${placeholders(fromIds.length)})`, [m.tx_id, ...fromIds]);
    if (toId === null || toId === m.own) continue;
    await db.run(
      `INSERT INTO transaction_parts (tx_id, category_id, amount_minor) VALUES (?, ?, ?)
        ON CONFLICT (tx_id, category_id) DO UPDATE SET amount_minor = amount_minor + excluded.amount_minor`, [m.tx_id, toId, m.amount]);
  }
}
