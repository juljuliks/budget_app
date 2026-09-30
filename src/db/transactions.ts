import { getDb } from './index';

export type CategorySource = 'user' | 'rule';

export type TransactionRow = {
  id: number;
  bank: string;
  kind: string;
  amount_minor: number;
  currency: string;
  raw_merchant: string | null;
  merchant_key: string | null;
  category_id: number | null;
  category_source: CategorySource | null;
  occurred_at: number;
  category_name: string | null;
  category_emoji: string | null;
};

/** Position of the last row of a page; pass it back to get the next (older) page. */
export type PageCursor = { occurred_at: number; id: number };

const SELECT_TX = `SELECT t.id, t.bank, t.kind, t.amount_minor, t.currency, t.raw_merchant, t.merchant_key, t.category_id, t.category_source, t.occurred_at, c.name AS category_name, c.emoji AS category_emoji
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id`;

/**
 * Newest first, keyset-paginated: stable even when new SMS arrive while scrolling
 * (OFFSET would shift and duplicate rows).
 */
export async function listTransactionsPage(cursor: PageCursor | null, limit = 50) {
  const db = await getDb();
  const rows = cursor
    ? await db.all<TransactionRow>(`${SELECT_TX}
        WHERE t.occurred_at < ? OR (t.occurred_at = ? AND t.id < ?)
        ORDER BY t.occurred_at DESC, t.id DESC LIMIT ?`,
        [cursor.occurred_at, cursor.occurred_at, cursor.id, limit])
    : await db.all<TransactionRow>(`${SELECT_TX} ORDER BY t.occurred_at DESC, t.id DESC LIMIT ?`, [limit]);
  const last = rows[rows.length - 1];
  return {
    rows,
    nextCursor: rows.length === limit && last ? { occurred_at: last.occurred_at, id: last.id } : null,
  };
}

export async function getTransaction(id: number) {
  const db = await getDb();
  return db.get<TransactionRow & { raw_sms: string }>(`SELECT t.*, c.name AS category_name, c.emoji AS category_emoji
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`, [id]);
}

/** categoryId = null clears the category. */
export async function setTransactionCategory(txId: number, categoryId: number | null, source: CategorySource) {
  const db = await getDb();
  return db.run('UPDATE transactions SET category_id = ?, category_source = ? WHERE id = ?',
    [categoryId, categoryId === null ? null : source, txId]);
}

export default { listTransactionsPage, getTransaction, setTransactionCategory };
