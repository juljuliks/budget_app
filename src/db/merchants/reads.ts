import { getDb } from '../index';
import type {} from '../types';
import { REMEMBERABLE_KINDS } from '../../domain/types';
import { merchantSpendingSql, signedSpendSql } from '../spending';
import { sqlList } from '../sql';

// The "Мерчанты" screen: merchants of purchases / payments (the only ones with a category), by category.

/** a merchant's own operations: what its category is remembered for */
export const KINDS = `(${sqlList(REMEMBERABLE_KINDS)})`;

export type MerchantRow = {
  /** the merchant_key */
  id: string;
  name: string;
  count: number;
  /** the merchant's category (its exact rule), null = none */
  category_id: number | null;
  /** of different categories: listed on its own, its primary category the first of its list */
  mixed: boolean;
  /** its purchases / payments of the last month (RECENT_DAYS), or, without any, of all time */
  activity: MerchantActivity;
};

/** How many days "the last month" of a merchant's activity covers. */
const RECENT_DAYS = 30;

export type MerchantActivity = {
  /** true: the last RECENT_DAYS days; false: all time (nothing in the last month) */
  recent: boolean;
  count: number;
  /** per currency, the biggest first */
  totals: Array<{ currency: string; amount_minor: number }>;
  /** first and last purchase of the counted ones (unix seconds) */
  from: number;
  to: number;
};

/** Every merchant_key, or only `key`: a condition on `t` and its params. */
const onlyKey = (key?: string) =>
  key === undefined ? { sql: 't.merchant_key IS NOT NULL', params: [] } : { sql: 't.merchant_key = ?', params: [key] };

/** The newest SMS spelling of each merchant_key (or of `key`). */
async function namesByKey(key?: string): Promise<Map<string, string>> {
  const db = await getDb();
  const w = onlyKey(key);
  const rows = await db.all<{ k: string; name: string | null }>(
    `SELECT merchant_key AS k, (SELECT raw_merchant FROM transactions x WHERE x.merchant_key = t.merchant_key
        ORDER BY x.occurred_at DESC LIMIT 1) AS name
      FROM transactions t WHERE ${w.sql} GROUP BY merchant_key`,
    w.params,
  );
  return new Map(rows.map((r) => [r.k, r.name || r.k]));
}

/** Every merchant with purchases / payments, the most frequent first. */
export async function listMerchants(): Promise<MerchantRow[]> {
  return merchantRows();
}

/** The merchants' rows (all, or the one of `key`). */
async function merchantRows(key?: string): Promise<MerchantRow[]> {
  const db = await getDb();
  const w = onlyKey(key);
  const names = await namesByKey(key);
  const counts = await db.all<{ mid: string; n: number }>(
    `SELECT t.merchant_key AS mid, count(*) AS n FROM transactions t
      WHERE ${w.sql} AND t.kind IN ${KINDS} GROUP BY mid`,
    w.params,
  );
  const activityOf = await merchantActivity(key);
  const rules = await db.all<{ pattern: string; category_id: number }>(
    `SELECT pattern, category_id FROM merchant_rules WHERE match_type = 'exact'${key === undefined ? '' : ' AND pattern = ?'}`,
    w.params,
  );
  const ruleOf = new Map(rules.map((r) => [r.pattern, r.category_id]));
  const mixed = new Set(
    (
      await db.all<{ k: string }>(
        `SELECT merchant_key AS k FROM mixed_merchants${key === undefined ? '' : ' WHERE merchant_key = ?'}`,
        w.params,
      )
    ).map((r) => r.k),
  );
  return counts
    .map(({ mid, n }) => ({
      id: mid,
      name: names.get(mid) ?? mid,
      count: n,
      category_id: mixed.has(mid) ? null : (ruleOf.get(mid) ?? null),
      mixed: mixed.has(mid),
      activity: activityOf.get(mid) ?? NO_ACTIVITY,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const NO_ACTIVITY: MerchantActivity = { recent: false, count: 0, totals: [], from: 0, to: 0 };

/** Each merchant id's (or `key`'s) purchases / payments: of the last RECENT_DAYS days if any, else of all time. */
async function merchantActivity(key?: string, now = Date.now()): Promise<Map<string, MerchantActivity>> {
  const db = await getDb();
  const w = onlyKey(key);
  const since = Math.floor(now / 1000) - RECENT_DAYS * 86400;
  const rows = await db.all<{
    mid: string;
    currency: string;
    recent: number;
    n: number;
    amount: number;
    recent_amount: number;
    first: number;
    last: number;
    recent_first: number | null;
  }>(
    `SELECT t.merchant_key AS mid, currency, count(*) AS n, sum(amount_minor) AS amount,
        sum(occurred_at >= ?) AS recent, sum(CASE WHEN occurred_at >= ? THEN amount_minor ELSE 0 END) AS recent_amount,
        min(occurred_at) AS first, max(occurred_at) AS last, min(CASE WHEN occurred_at >= ? THEN occurred_at END) AS recent_first
      FROM transactions t WHERE ${w.sql} AND t.kind IN ${KINDS} GROUP BY mid, currency`,
    [since, since, since, ...w.params],
  );
  const byMid = new Map<string, typeof rows>();
  for (const r of rows) byMid.set(r.mid, [...(byMid.get(r.mid) ?? []), r]);
  const out = new Map<string, MerchantActivity>();
  for (const [mid, rs] of byMid) {
    const recent = rs.some((r) => r.recent > 0);
    const used = recent ? rs.filter((r) => r.recent > 0) : rs;
    out.set(mid, {
      recent,
      count: used.reduce((a, r) => a + (recent ? r.recent : r.n), 0),
      totals: used
        .map((r) => ({ currency: r.currency, amount_minor: recent ? r.recent_amount : r.amount }))
        .sort((a, b) => b.amount_minor - a.amount_minor),
      from: Math.min(...used.map((r) => (recent ? r.recent_first! : r.first))),
      to: Math.max(...used.map((r) => r.last)),
    });
  }
  return out;
}

export type MerchantDetails = MerchantRow & {
  totals: Array<{ currency: string; amount_minor: number }>;
};

export async function getMerchant(id: string): Promise<MerchantDetails | null> {
  const [row] = await merchantRows(id);
  if (!row) return null;
  const db = await getDb();
  // spent there: purchases / payments minus refunds not settled on a purchase (a settled one already reduced it)
  const totals = await db.all<{ currency: string; amount_minor: number }>(
    `SELECT currency, sum(${signedSpendSql('t')}) AS amount_minor FROM transactions t
      WHERE t.merchant_key = ? AND ${merchantSpendingSql('t')}
      GROUP BY currency HAVING sum(${signedSpendSql('t')}) != 0
      ORDER BY amount_minor DESC`,
    [id],
  );
  return { ...row, totals };
}
