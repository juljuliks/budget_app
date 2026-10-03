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
  /** refunds: when it was settled on its purchase (see refunds.ts) */
  refund_settled_at: number | null;
  category_name: string | null;
  category_emoji: string | null;
  category_type_name: string | null;
};

/** Position of the last row of a page; pass it back to get the next (older) page. */
export type PageCursor = { occurred_at: number; id: number };

const CATEGORY_COLUMNS = 'c.name AS category_name, c.emoji AS category_emoji, ct.name AS category_type_name';
const TX_COLUMNS = `t.id, t.bank, t.kind, t.amount_minor, t.currency, t.raw_merchant, t.merchant_key, t.category_id,
    t.category_source, t.occurred_at, t.seen_at, t.refund_settled_at, ${CATEGORY_COLUMNS}`;
const FROM_TX = `FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN category_types ct ON ct.id = c.type_id`;
const SELECT_TX = `SELECT ${TX_COLUMNS} ${FROM_TX}`;
const NEWEST_FIRST = 'ORDER BY t.occurred_at DESC, t.id DESC';

/**
 * Newest first, keyset-paginated: stable even when new SMS arrive while scrolling
 * (OFFSET would shift and duplicate rows).
 */
export async function listTransactionsPage(cursor: PageCursor | null, limit = 50) {
  const db = await getDb();
  const rows = cursor
    ? await db.all<TransactionRow>(`${SELECT_TX}
        WHERE t.occurred_at < ? OR (t.occurred_at = ? AND t.id < ?)
        ${NEWEST_FIRST} LIMIT ?`,
        [cursor.occurred_at, cursor.occurred_at, cursor.id, limit])
    : await db.all<TransactionRow>(`${SELECT_TX} ${NEWEST_FIRST} LIMIT ?`, [limit]);
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

/**
 * Transactions whose SMS text, merchant / description, category or category type contain every
 * word of the query. Newest first, at most SEARCH_LIMIT rows (a few thousand rows a year scan fast).
 */
export async function searchTransactions(query: string, limit = SEARCH_LIMIT): Promise<TransactionRow[]> {
  const words = normalizeForSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const db = await getDb();
  const rows = await db.all<TransactionRow & { raw_sms: string; note: string | null }>(
    `SELECT t.raw_sms, t.note, ${TX_COLUMNS} ${FROM_TX} ${NEWEST_FIRST}`);
  const out: TransactionRow[] = [];
  for (const r of rows) {
    const haystack = normalizeForSearch(
      [r.raw_sms, r.note, r.raw_merchant, r.category_name, r.category_type_name, r.category_id === null ? UNCATEGORIZED : '']
        .filter(Boolean).join(' '));
    if (words.every((w) => haystack.includes(w))) {
      out.push(r);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Category filter: a category id, 'none' = uncategorized. */
export type CategoryFilter = number | 'none';

export type TxFilter = {
  category?: CategoryFilter;
  /** unix seconds, [from, to) */
  from?: number;
  to?: number;
};

const FILTER_LIMIT = 2000;

/** Exact filters (category, date range); newest first, no pagination (capped). */
export async function listTransactionsFiltered(f: TxFilter, limit = FILTER_LIMIT): Promise<TransactionRow[]> {
  const where: string[] = [];
  const params: Array<number> = [];
  if (f.category === 'none') where.push('t.category_id IS NULL');
  else if (f.category !== undefined) { where.push('t.category_id = ?'); params.push(f.category); }
  if (f.from !== undefined) { where.push('t.occurred_at >= ?'); params.push(f.from); }
  if (f.to !== undefined) { where.push('t.occurred_at < ?'); params.push(f.to); }
  const db = await getDb();
  return db.all<TransactionRow>(
    `${SELECT_TX} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${NEWEST_FIRST} LIMIT ?`,
    [...params, limit]);
}

export type CategoryWithCount = {
  category: CategoryFilter;
  name: string;
  emoji: string | null;
  type_name: string | null;
  deleted: boolean;
  count: number;
};

/** Categories that have at least one transaction (deleted ones too: they keep past transactions), plus "Без категории". */
export async function categoriesWithTransactions(): Promise<CategoryWithCount[]> {
  const db = await getDb();
  const rows = await db.all<{ category_id: number | null; name: string | null; emoji: string | null; type_name: string | null; deleted_at: number | null; n: number }>(
    `SELECT t.category_id, c.name, c.emoji, ct.name AS type_name, c.deleted_at, count(*) AS n
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN category_types ct ON ct.id = c.type_id
      GROUP BY t.category_id
      ORDER BY t.category_id IS NULL, c.deleted_at IS NOT NULL, ct.id IS NULL, ct.sort_order, c.sort_order, c.name`);
  return rows.map((r) => ({
    category: r.category_id ?? 'none',
    name: r.category_id === null ? UNCATEGORIZED : r.name ?? '?',
    emoji: r.emoji,
    type_name: r.type_name,
    deleted: r.deleted_at !== null,
    count: r.n,
  }));
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
  return db.get<TransactionRow & { raw_sms: string; note: string | null; merchant_detached: number }>(
    `SELECT t.*, ${CATEGORY_COLUMNS} ${FROM_TX} WHERE t.id = ?`, [id]);
}

/** Free-text note shown under the SMS; empty clears it. */
export async function setTransactionNote(id: number, note: string) {
  const db = await getDb();
  await db.run('UPDATE transactions SET note = ? WHERE id = ?', [note.trim() || null, id]);
}

/**
 * "Открепить мерчанта для этой транзакции": merchant rules no longer touch this transaction and choosing its
 * category doesn't teach the merchant. Reattaching goes through reattachMerchant (assign.ts).
 */
export async function setMerchantDetached(id: number, detached: boolean) {
  const db = await getDb();
  await db.run('UPDATE transactions SET merchant_detached = ? WHERE id = ?', [detached ? 1 : 0, id]);
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
  listTransactionsPage, listTransactionsFiltered, categoriesWithTransactions, searchTransactions, getTransaction, setTransactionCategory, setCategoryForTransactions,
  addManualTransaction, deleteTransaction, markTransactionSeen, countUnseenTransactions,
};
