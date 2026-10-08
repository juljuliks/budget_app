import { getDb } from './index';
import { currentYm, monthStart } from './plans';

/** How many operations and how much (spent minus refunds and deposits, per currency, the biggest first). */
export type Bucket = { n: number; totals: Array<{ currency: string; amount_minor: number }> };

const SPENT = "sum(CASE WHEN t.kind IN ('refund', 'deposit') THEN -t.amount_minor ELSE t.amount_minor END)";

async function bucket(where: string, params: Array<number | string>): Promise<Bucket> {
  const db = await getDb();
  const rows = await db.all<{ currency: string; amount_minor: number; n: number }>(
    `SELECT t.currency, ${SPENT} AS amount_minor, count(*) AS n FROM transactions t WHERE ${where}
      GROUP BY t.currency ORDER BY amount_minor DESC`, params);
  return { n: rows.reduce((a, r) => a + r.n, 0), totals: rows.map(({ currency, amount_minor }) => ({ currency, amount_minor })) };
}

/** What deleting a category touches: this month's operations (to move), the past ones (kept), its merchants, its plan. */
export type DeletePreview = {
  current: Bucket;
  past: Bucket;
  /** the merchants it is the category of (newest spelling), the most frequent first */
  merchants: string[];
  /** a plan item this month (or later): it goes with the category */
  hasPlan: boolean;
};

export async function categoryDeletePreview(id: number, nowYm = currentYm()): Promise<DeletePreview> {
  const db = await getDb();
  const from = monthStart(nowYm);
  const merchants = await db.all<{ name: string }>(
    `SELECT coalesce((SELECT x.raw_merchant FROM transactions x WHERE x.merchant_key = r.pattern ORDER BY x.occurred_at DESC LIMIT 1), r.pattern) AS name
      FROM merchant_rules r WHERE r.category_id = ? AND r.match_type = 'exact'
      ORDER BY (SELECT count(*) FROM transactions x WHERE x.merchant_key = r.pattern) DESC, name`, [id]);
  const plan = await db.get('SELECT 1 FROM plan_items WHERE category_id = ? AND ym >= ? LIMIT 1', [id, nowYm]);
  return {
    current: await bucket('t.category_id = ? AND t.occurred_at >= ?', [id, from]),
    past: await bucket('t.category_id = ? AND t.occurred_at < ?', [id, from]),
    merchants: merchants.map((m) => m.name),
    hasPlan: !!plan,
  };
}

/** This month's operations still in the category being sorted out. */
export async function remainingInCategory(id: number, nowYm = currentYm()): Promise<Bucket> {
  return bucket('t.category_id = ? AND t.occurred_at >= ?', [id, monthStart(nowYm)]);
}

/** This month's operations of the category: what a sort-out starts with (to tell at the end where they went). */
export async function currentIdsOfCategory(id: number, nowYm = currentYm()): Promise<number[]> {
  const db = await getDb();
  return (await db.all<{ id: number }>('SELECT id FROM transactions WHERE category_id = ? AND occurred_at >= ?', [id, monthStart(nowYm)]))
    .map((r) => r.id);
}

export type SortOutSummary = {
  /** where the operations went: a category (null = none), how many and how much; the most first */
  moved: Array<Bucket & { category_id: number | null; name: string | null; emoji: string | null; type_name: string | null }>;
  /** deleted meanwhile */
  deleted: Bucket;
};

/** Where the operations `ids` (this month's of `sourceId` when the sort-out began) are now. */
export async function sortOutSummary(sourceId: number, ids: number[]): Promise<SortOutSummary> {
  if (ids.length === 0) return { moved: [], deleted: { n: 0, totals: [] } };
  const db = await getDb();
  const marks = ids.map(() => '?').join(',');
  const rows = await db.all<{ category_id: number | null; name: string | null; emoji: string | null; type_name: string | null; currency: string; amount_minor: number; n: number }>(
    `SELECT t.category_id, c.name, c.emoji, ct.name AS type_name, t.currency, ${SPENT} AS amount_minor, count(*) AS n
      FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN category_types ct ON ct.id = c.type_id
      WHERE t.id IN (${marks}) AND (t.category_id IS NULL OR t.category_id != ?)
      GROUP BY t.category_id, t.currency ORDER BY amount_minor DESC`, [...ids, sourceId]);
  const moved = new Map<number | null, SortOutSummary['moved'][number]>();
  for (const r of rows) {
    let m = moved.get(r.category_id);
    if (!m) moved.set(r.category_id, m = { category_id: r.category_id, name: r.name, emoji: r.emoji, type_name: r.type_name, n: 0, totals: [] });
    m.n += r.n;
    m.totals.push({ currency: r.currency, amount_minor: r.amount_minor });
  }
  const left = await db.get<{ n: number }>(`SELECT count(*) AS n FROM transactions WHERE id IN (${marks})`, ids);
  return {
    moved: [...moved.values()].sort((a, b) => b.n - a.n),
    // the amounts of deleted ones are gone with them: only how many
    deleted: { n: ids.length - (left?.n ?? 0), totals: [] },
  };
}

/**
 * Keeps the past in the category: its operations before this month that follow their merchant become fixed, so a
 * merchant moved elsewhere (now or later) doesn't take them along. `merchantKeys`: only those merchants' (else all).
 */
export async function freezePastOfCategory(id: number, merchantKeys?: string[], nowYm = currentYm()) {
  if (merchantKeys && merchantKeys.length === 0) return;
  const db = await getDb();
  const only = merchantKeys ? ` AND merchant_key IN (${merchantKeys.map(() => '?').join(',')})` : '';
  await db.run(
    `UPDATE transactions SET category_source = 'user' WHERE category_id = ? AND occurred_at < ? AND category_source = 'rule'${only}`,
    [id, monthStart(nowYm), ...(merchantKeys ?? [])]);
}
