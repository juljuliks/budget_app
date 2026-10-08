import { NO_CATEGORY_EMOJI } from '../colors';
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

/** Lowercase + ё→е. Done in JS: SQLite LIKE / lower() only fold ASCII, so Cyrillic search would be case-sensitive. */
export function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

const SEARCH_LIMIT = 500;
/** uncategorized transactions match this phrase (what the UI calls them) */
const UNCATEGORIZED = 'Без категории';

/** Category filter: a category id, 'none' = uncategorized. */
export type CategoryFilter = number | 'none';

export type TxFilter = {
  category?: CategoryFilter;
  /** a merchant_key */
  merchant?: string;
  /** any of these categories ('none' = uncategorized) */
  categories?: CategoryFilter[];
  /** any of these merchants */
  merchants?: string[];
  /** any of these kinds ('purchase', 'refund', …) */
  kinds?: string[];
  /** unix seconds, [from, to) */
  from?: number;
  to?: number;
  /** only these (what a text search found) */
  ids?: number[];
};

const FILTER_LIMIT = 2000;

/** WHERE for the exact filters, combined (all must match). */
function filterWhere(f: TxFilter): { sql: string; params: Array<number | string> } {
  const where: string[] = [];
  const params: Array<number | string> = [];
  if (f.category === 'none') where.push('t.category_id IS NULL');
  else if (f.category !== undefined) { where.push('t.category_id = ?'); params.push(f.category); }
  if (f.merchant !== undefined) { where.push('t.merchant_key = ?'); params.push(f.merchant); }
  if (f.categories?.length) {
    const ids = f.categories.filter((c): c is number => c !== 'none');
    const any: string[] = [];
    if (ids.length) { any.push(`t.category_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    if (f.categories.includes('none')) any.push('t.category_id IS NULL');
    where.push(`(${any.join(' OR ')})`);
  }
  if (f.kinds?.length) {
    where.push(`t.kind IN (${f.kinds.map(() => '?').join(',')})`);
    params.push(...f.kinds);
  }
  if (f.merchants?.length) {
    where.push(`t.merchant_key IN (${f.merchants.map(() => '?').join(',')})`);
    params.push(...f.merchants);
  }
  if (f.from !== undefined) { where.push('t.occurred_at >= ?'); params.push(f.from); }
  if (f.to !== undefined) { where.push('t.occurred_at < ?'); params.push(f.to); }
  if (f.ids) {
    where.push(f.ids.length ? `t.id IN (${f.ids.map(() => '?').join(',')})` : '0');
    params.push(...f.ids);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Exact filters (category, merchant, date range), all combined; newest first, no pagination (capped). */
export async function listTransactionsFiltered(f: TxFilter, limit = FILTER_LIMIT): Promise<TransactionRow[]> {
  const { sql, params } = filterWhere(f);
  const db = await getDb();
  return db.all<TransactionRow>(`${SELECT_TX} ${sql} ${NEWEST_FIRST} LIMIT ?`, [...params, limit]);
}

/**
 * Transactions whose SMS text, merchant / description, category or category type contain every
 * word of the query, among those matching the exact filters. Newest first, at most SEARCH_LIMIT rows.
 */
export async function searchTransactions(query: string, f: TxFilter = {}, limit = SEARCH_LIMIT): Promise<TransactionRow[]> {
  const words = normalizeForSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const { sql, params } = filterWhere(f);
  const db = await getDb();
  const rows = await db.all<TransactionRow & { raw_sms: string; note: string | null }>(
    `SELECT t.raw_sms, t.note, ${TX_COLUMNS} ${FROM_TX} ${sql} ${NEWEST_FIRST}`, params);
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

/** Kinds that occur, with their counts, for the "Тип" filter. */
export async function kindsWithTransactions(): Promise<Array<{ kind: string; count: number }>> {
  const db = await getDb();
  return db.all<{ kind: string; count: number }>('SELECT kind, count(*) AS count FROM transactions GROUP BY kind ORDER BY count DESC');
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
    emoji: r.category_id === null ? NO_CATEGORY_EMOJI : r.emoji,
    type_name: r.type_name,
    deleted: r.deleted_at !== null,
    count: r.n,
  }));
}

export type MerchantWithCount = { merchant: string; name: string; count: number };

/** Merchants that have transactions (shops, people of deposits): the most frequent first. `merchant` is the merchant_key. */
export async function merchantsWithTransactions(): Promise<MerchantWithCount[]> {
  const db = await getDb();
  // a merchant by its name in the newest SMS
  const rows = await db.all<{ mid: string; name: string | null; n: number }>(
    `SELECT t.merchant_key AS mid,
        (SELECT raw_merchant FROM transactions x WHERE x.merchant_key = t.merchant_key ORDER BY x.occurred_at DESC LIMIT 1) AS name,
        count(*) AS n
      FROM transactions t WHERE t.merchant_key IS NOT NULL
      GROUP BY mid ORDER BY n DESC, name`);
  return rows.map((r) => ({ merchant: r.mid, name: r.name || r.mid, count: r.n }));
}

/** Bulk "change category" from the list: a manual choice ("Без категории" too), so no merchant rules are created. */
export async function setCategoryForTransactions(txIds: number[], categoryId: number | null) {
  if (txIds.length === 0) return;
  const db = await getDb();
  await db.run(
    `UPDATE transactions SET category_id = ?, category_source = ? WHERE id IN (${txIds.map(() => '?').join(',')})`,
    [categoryId, 'user', ...txIds]);
}

export async function getTransaction(id: number) {
  const db = await getDb();
  return db.get<TransactionRow & { raw_sms: string; note: string | null }>(
    `SELECT t.*, ${CATEGORY_COLUMNS} ${FROM_TX} WHERE t.id = ?`, [id]);
}

/** Corrects a transaction's amount and currency (e.g. the SMS was wrong or a manual entry was mistyped). */
export async function setTransactionAmount(id: number, amountMinor: number, currency: string) {
  const db = await getDb();
  await db.run('UPDATE transactions SET amount_minor = ?, currency = ? WHERE id = ?', [amountMinor, currency, id]);
}

/** Free-text note shown under the SMS; empty clears it. */
export async function setTransactionNote(id: number, note: string) {
  const db = await getDb();
  await db.run('UPDATE transactions SET note = ? WHERE id = ?', [note.trim() || null, id]);
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

/** "Прочитать (N)" in edit mode: the selected transactions are marked read. */
export async function markTransactionsSeen(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const { changes } = await db.run(
    `UPDATE transactions SET seen_at = ? WHERE seen_at IS NULL AND id IN (${ids.map(() => '?').join(',')})`,
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

export default {
  listTransactionsPage, listTransactionsFiltered, categoriesWithTransactions, searchTransactions, getTransaction, setTransactionCategory, setCategoryForTransactions,
  addManualTransaction, deleteTransaction, markTransactionSeen, countUnseenTransactions,
};

/** How the operations list is split into sections besides by day. */
export type GroupKind = 'merchant' | 'category' | 'month' | 'kind' | 'amount';

/** "По сумме": the lower bound of each band, biggest first (minor units of the operation's own currency). */
export const AMOUNT_BANDS = [100000, 50000, 10000, 2000, 0];

/** The group an operation falls in (no merchant: '', no category: 'none'; amount: the band's index). */
const GROUP_KEY: Record<GroupKind, string> = {
  merchant: "coalesce(t.merchant_key, lower(trim(t.raw_merchant)), '')",
  category: "coalesce(CAST(t.category_id AS TEXT), 'none')",
  month: "strftime('%Y-%m', t.occurred_at, 'unixepoch', 'localtime')",
  kind: 't.kind',
  amount: `CASE ${AMOUNT_BANDS.slice(0, -1).map((b, i) => `WHEN abs(t.amount_minor) >= ${b} THEN '${i}'`).join(' ')} ELSE '${AMOUNT_BANDS.length - 1}' END`,
};

/**
 * The order of the groups (over k, n = operations, last = the newest one): months newest first, amounts biggest
 * first; merchants, categories and kinds by how many operations, the newest on a tie, "без мерчанта" last and
 * "без категории" first (what needs a category).
 */
const GROUP_ORDER: Record<GroupKind, string> = {
  merchant: "(k = '') , n DESC, last DESC, k",
  category: "(k <> 'none'), n DESC, last DESC, k",
  month: 'k DESC',
  kind: 'n DESC, last DESC, k',
  amount: 'k',
};
/** Inside a group: newest first, by amount the biggest first. */
const ROW_ORDER = (by: GroupKind) => (by === 'amount' ? 'abs(t.amount_minor) DESC, t.occurred_at DESC, t.id DESC' : 't.occurred_at DESC, t.id DESC');
// spent minus received (the kinds that bring money in, as the list shows them)
const SIGNED = "CASE WHEN t.kind IN ('deposit', 'refund') THEN t.amount_minor ELSE -t.amount_minor END";

export type TransactionGroup = {
  key: string;
  count: number;
  /** spent minus received, per currency (negative = spent) */
  totals: Array<{ currency: string; total: number }>;
  /** the newest operation's, to name the group */
  raw_merchant: string | null;
  kind: string;
  occurred_at: number;
} & Pick<TransactionRow, 'category_id' | 'category_name' | 'category_emoji' | 'category_type_name'>;

/** The groups of the operations matching `f`, in their order, each with its count and totals. */
export async function listTransactionGroups(f: TxFilter, by: GroupKind): Promise<TransactionGroup[]> {
  const { sql, params } = filterWhere(f);
  const db = await getDb();
  const key = GROUP_KEY[by];
  // the bare columns come from the row with max(occurred_at): the group's newest operation
  const groups = await db.all<Omit<TransactionGroup, 'totals'> & { k: string; n: number }>(
    `SELECT ${key} AS k, count(*) AS n, max(t.occurred_at) AS last, t.occurred_at, t.raw_merchant, t.kind, t.category_id, ${CATEGORY_COLUMNS}
      ${FROM_TX} ${sql} GROUP BY k ORDER BY ${GROUP_ORDER[by]}`, params);
  const totals = await db.all<{ k: string; currency: string; total: number }>(
    `SELECT ${key} AS k, t.currency, sum(${SIGNED}) AS total FROM transactions t ${sql} GROUP BY k, t.currency ORDER BY t.currency`, params);
  return groups.map(({ k, n, ...g }) => ({
    ...g, key: k, count: n,
    totals: totals.filter((t) => t.k === k).map(({ currency, total }) => ({ currency, total })),
  }));
}

/** A page of the operations matching `f` in the groups' order (see listTransactionGroups), each with its group. */
export async function listGroupedPage(f: TxFilter, by: GroupKind, offset: number, limit = 50): Promise<Array<TransactionRow & { group_key: string }>> {
  const { sql, params } = filterWhere(f);
  const db = await getDb();
  const key = GROUP_KEY[by];
  return db.all(
    `WITH g AS (SELECT ${key} AS k, count(*) AS n, max(t.occurred_at) AS last FROM transactions t ${sql} GROUP BY k)
      SELECT ${TX_COLUMNS}, g.k AS group_key ${FROM_TX} JOIN g ON g.k = ${key} ${sql}
      ORDER BY ${GROUP_ORDER[by]}, ${ROW_ORDER(by)} LIMIT ? OFFSET ?`,
    [...params, ...params, limit, offset]);
}

/** Every operation of one group (its checkbox selects the ones not loaded yet too). */
export async function transactionGroupIds(f: TxFilter, by: GroupKind, groupKey: string): Promise<number[]> {
  const { sql, params } = filterWhere(f);
  const db = await getDb();
  const rows = await db.all<{ id: number }>(
    `SELECT t.id FROM transactions t ${sql ? `${sql} AND` : 'WHERE'} ${GROUP_KEY[by]} = ?`, [...params, groupKey]);
  return rows.map((r) => r.id);
}
