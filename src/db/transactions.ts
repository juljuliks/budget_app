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
  /** null = not opened yet; unread = not opened AND uncategorized (see isUnread) */
  seen_at: number | null;
  category_name: string | null;
  category_emoji: string | null;
  category_type_name: string | null;
};

/** Position of the last row of a page; pass it back to get the next (older) page. */
export type PageCursor = { occurred_at: number; id: number };

const SELECT_TX = `SELECT t.id, t.bank, t.kind, t.amount_minor, t.currency, t.raw_merchant, t.merchant_key, t.category_id, t.category_source, t.occurred_at, t.seen_at, c.name AS category_name, c.emoji AS category_emoji, ct.name AS category_type_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN category_types ct ON ct.id = c.type_id`;

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

/** Lowercase + ё→е. Done in JS: SQLite LIKE / lower() only fold ASCII, so Cyrillic search would be case-sensitive. */
export function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

const SEARCH_LIMIT = 500;
/** uncategorized transactions match this phrase (what the UI calls them) */
const UNCATEGORIZED = 'Без категории';

/** Search query that finds a category's transactions (type + name, no ":" so words match). */
export function categorySearchQuery(c: { name: string; type_name?: string | null; category_id?: number | null }): string {
  if (c.category_id === null) return UNCATEGORIZED;
  return [c.type_name, c.name].filter(Boolean).join(' ');
}

/**
 * Transactions whose SMS text, merchant / description, category or category type contain every
 * word of the query. Newest first, at most SEARCH_LIMIT rows (a few thousand rows a year scan fast).
 */
export async function searchTransactions(query: string, limit = SEARCH_LIMIT): Promise<TransactionRow[]> {
  const words = normalizeForSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const db = await getDb();
  const rows = await db.all<TransactionRow & { raw_sms: string }>(
    `${SELECT_TX.replace('SELECT t.id,', 'SELECT t.raw_sms, t.id,')} ORDER BY t.occurred_at DESC, t.id DESC`);
  const out: TransactionRow[] = [];
  for (const r of rows) {
    const haystack = normalizeForSearch(
      [r.raw_sms, r.raw_merchant, r.category_name, r.category_type_name, r.category_id === null ? UNCATEGORIZED : '']
        .filter(Boolean).join(' '));
    if (words.every((w) => haystack.includes(w))) {
      out.push(r);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Bulk "change category" from the list: a manual choice, so no merchant rules are created. */
export async function setCategoryForTransactions(txIds: number[], categoryId: number | null) {
  if (txIds.length === 0) return;
  const db = await getDb();
  await db.run(
    `UPDATE transactions SET category_id = ?, category_source = ? WHERE id IN (${txIds.map(() => '?').join(',')})`,
    [categoryId, categoryId === null ? null : 'user', ...txIds]);
}

export async function getTransaction(id: number) {
  const db = await getDb();
  return db.get<TransactionRow & { raw_sms: string }>(`SELECT t.*, c.name AS category_name, c.emoji AS category_emoji, ct.name AS category_type_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN category_types ct ON ct.id = c.type_id
    WHERE t.id = ?`, [id]);
}

/** Opening a transaction marks it read. Returns true if it was unread. */
export async function markTransactionSeen(id: number): Promise<boolean> {
  const db = await getDb();
  const { changes } = await db.run(
    'UPDATE transactions SET seen_at = ? WHERE id = ? AND seen_at IS NULL', [Math.floor(Date.now() / 1000), id]);
  return changes > 0;
}

/**
 * Unread = still needs attention: never opened and no category yet. A category (from a merchant rule,
 * a notification button or bulk edit) means it's been dealt with, even if it was never opened.
 */
export function isUnread(t: Pick<TransactionRow, 'seen_at' | 'category_id'>): boolean {
  return t.seen_at === null && t.category_id === null;
}

export async function countUnseenTransactions(): Promise<number> {
  const db = await getDb();
  return (await db.get<{ n: number }>(
    'SELECT count(*) AS n FROM transactions WHERE seen_at IS NULL AND category_id IS NULL'))!.n;
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  await db.run('DELETE FROM transactions WHERE id = ?', [id]);
}

/** categoryId = null clears the category. */
export async function setTransactionCategory(txId: number, categoryId: number | null, source: CategorySource) {
  const db = await getDb();
  return db.run('UPDATE transactions SET category_id = ?, category_source = ? WHERE id = ?',
    [categoryId, categoryId === null ? null : source, txId]);
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

export default {
  listTransactionsPage, searchTransactions, getTransaction, setTransactionCategory, setCategoryForTransactions,
  addManualTransaction, deleteTransaction, markTransactionSeen, countUnseenTransactions,
};
