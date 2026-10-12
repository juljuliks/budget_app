// An operation's row, the list's pages (a keyset cursor by day), one operation, the unread ones.
import { getDb } from '../index';
import { TxFilter, filterWhere } from './filter';
import { CATEGORY_COLUMNS, FROM_TX, NEWEST_FIRST, PARTS_COLUMN, SELECT_TX } from './sql';

export type CategorySource = 'user' | 'rule';

export type TransactionRow = {
  id: number;
  bank: string;
  kind: string;
  amount_minor: number;
  currency: string;
  raw_merchant: string | null;
  merchant_key: string | null;
  /** "Описание": the user's text; a manual operation's is the one entered with it (its row's title) */
  note: string | null;
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
  /** a split operation's parts in other categories (PARTS_COLUMN; parseParts), null = not split */
  parts: string | null;
  /** the list filtered by categories: those (a split operation shows its parts in them) */
  focus?: number[];
};

/** Position of the last row of a page; pass it back to get the next (older) page. */
export type PageCursor = { occurred_at: number; id: number };

/**
 * Newest first, keyset-paginated: stable even when new SMS arrive while scrolling
 * (OFFSET would shift and duplicate rows).
 */
export async function listTransactionsPage(cursor: PageCursor | null, limit = 50, f: TxFilter = {}) {
  const db = await getDb();
  const { sql, params } = filterWhere(f);
  const rows = cursor
    ? await db.all<TransactionRow>(`${SELECT_TX}
        ${sql ? `${sql} AND` : 'WHERE'} (t.occurred_at < ? OR (t.occurred_at = ? AND t.id < ?))
        ${NEWEST_FIRST} LIMIT ?`,
        [...params, cursor.occurred_at, cursor.occurred_at, cursor.id, limit])
    : await db.all<TransactionRow>(`${SELECT_TX} ${sql} ${NEWEST_FIRST} LIMIT ?`, [...params, limit]);
  const last = rows[rows.length - 1];
  return {
    rows,
    nextCursor: rows.length === limit && last ? { occurred_at: last.occurred_at, id: last.id } : null,
  };
}

export async function getTransaction(id: number) {
  const db = await getDb();
  return db.get<TransactionRow & { raw_sms: string }>(
    `SELECT t.*, ${CATEGORY_COLUMNS}, ${PARTS_COLUMN} ${FROM_TX} WHERE t.id = ?`, [id]);
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
