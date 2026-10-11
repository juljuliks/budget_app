// The list's filters as SQL, the text search, what the filters offer (kinds, categories, merchants with counts).
import { NO_CATEGORY_EMOJI } from '../../colors';
import { getDb } from '../index';
import type { TransactionRow } from './rows';
import { FROM_TX, NEWEST_FIRST, SELECT_TX, TX_COLUMNS } from './sql';

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
export function filterWhere(f: TxFilter): { sql: string; params: Array<number | string> } {
  const { sql, params } = filterCondition(f);
  return { sql: sql === '1' ? '' : `WHERE ${sql}`, params };
}

/** The filters as one condition on `t` (the transactions' alias), '1' when none: for other queries over the same operations. */
export function filterCondition(f: TxFilter): { sql: string; params: Array<number | string> } {
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
  return { sql: where.length ? where.join(' AND ') : '1', params };
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
