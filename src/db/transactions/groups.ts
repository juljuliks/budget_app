// The list grouped another way than by day (merchant, category, month, kind, amount): groups, pages, their ids.
import { getDb } from '../index';
import type { TransactionRow } from './rows';
import { TxFilter, filterWhere } from './filter';
import { CATEGORY_COLUMNS, FROM_TX, TX_COLUMNS } from './sql';

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

/** Every operation of one day (from `dayStart`, unix seconds, to the next day) matching `f`: the day header's checkbox. */
export async function transactionDayIds(f: TxFilter, dayStart: number, dayEnd: number): Promise<number[]> {
  const { sql, params } = filterWhere(f);
  const db = await getDb();
  const rows = await db.all<{ id: number }>(
    `SELECT t.id FROM transactions t ${sql ? `${sql} AND` : 'WHERE'} t.occurred_at >= ? AND t.occurred_at < ?`, [...params, dayStart, dayEnd]);
  return rows.map((r) => r.id);
}

/** Every operation of one group (its checkbox selects the ones not loaded yet too). */
export async function transactionGroupIds(f: TxFilter, by: GroupKind, groupKey: string): Promise<number[]> {
  const { sql, params } = filterWhere(f);
  const db = await getDb();
  const rows = await db.all<{ id: number }>(
    `SELECT t.id FROM transactions t ${sql ? `${sql} AND` : 'WHERE'} ${GROUP_KEY[by]} = ?`, [...params, groupKey]);
  return rows.map((r) => r.id);
}
