import { getDb } from './index';
import { backfillRule, createRule } from '../categorize';
import { categoryChangeTotals } from '../assign';
import { REMEMBERABLE_KINDS } from '../types';

// The "Мерчанты" screen: merchants of purchases / payments (the only ones with a category), by category.

const KINDS = `(${REMEMBERABLE_KINDS.map((k) => `'${k}'`).join(',')})`;

export type MerchantRow = {
  /** the merchant_key */
  id: string;
  name: string;
  count: number;
  /** the merchant's category (its exact rule), null = none */
  category_id: number | null;
  /** of different categories: none of its own, each new operation asks */
  mixed: boolean;
  /** its purchases / payments of the last month (RECENT_DAYS), or, without any, of all time */
  activity: MerchantActivity;
};

/** How many days "the last month" of a merchant's activity covers. */
export const RECENT_DAYS = 30;

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

/** The newest SMS spelling of each merchant_key. */
async function namesByKey(): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db.all<{ k: string; name: string | null }>(
    `SELECT merchant_key AS k, (SELECT raw_merchant FROM transactions x WHERE x.merchant_key = t.merchant_key
        ORDER BY x.occurred_at DESC LIMIT 1) AS name
      FROM transactions t WHERE merchant_key IS NOT NULL GROUP BY merchant_key`);
  return new Map(rows.map((r) => [r.k, r.name || r.k]));
}

/** Every merchant with purchases / payments, the most frequent first. */
export async function listMerchants(): Promise<MerchantRow[]> {
  const db = await getDb();
  const names = await namesByKey();
  const counts = await db.all<{ mid: string; n: number }>(
    `SELECT t.merchant_key AS mid, count(*) AS n FROM transactions t
      WHERE t.merchant_key IS NOT NULL AND t.kind IN ${KINDS} GROUP BY mid`);
  const activityOf = await merchantActivity();
  const rules = await db.all<{ pattern: string; category_id: number }>("SELECT pattern, category_id FROM merchant_rules WHERE match_type = 'exact'");
  const ruleOf = new Map(rules.map((r) => [r.pattern, r.category_id]));
  const mixed = new Set((await db.all<{ k: string }>('SELECT merchant_key AS k FROM mixed_merchants')).map((r) => r.k));
  return counts.map(({ mid, n }) => ({
    id: mid, name: names.get(mid) ?? mid, count: n, category_id: mixed.has(mid) ? null : ruleOf.get(mid) ?? null, mixed: mixed.has(mid),
    activity: activityOf.get(mid) ?? NO_ACTIVITY,
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const NO_ACTIVITY: MerchantActivity = { recent: false, count: 0, totals: [], from: 0, to: 0 };

/** Each merchant id's purchases / payments: of the last RECENT_DAYS days if any, else of all time. */
async function merchantActivity(now = Date.now()): Promise<Map<string, MerchantActivity>> {
  const db = await getDb();
  const since = Math.floor(now / 1000) - RECENT_DAYS * 86400;
  const rows = await db.all<{ mid: string; currency: string; recent: number; n: number; amount: number; recent_amount: number; first: number; last: number; recent_first: number | null }>(
    `SELECT t.merchant_key AS mid, currency, count(*) AS n, sum(amount_minor) AS amount,
        sum(occurred_at >= ?) AS recent, sum(CASE WHEN occurred_at >= ? THEN amount_minor ELSE 0 END) AS recent_amount,
        min(occurred_at) AS first, max(occurred_at) AS last, min(CASE WHEN occurred_at >= ? THEN occurred_at END) AS recent_first
      FROM transactions t WHERE t.merchant_key IS NOT NULL AND t.kind IN ${KINDS} GROUP BY mid, currency`,
    [since, since, since]);
  const byMid = new Map<string, typeof rows>();
  for (const r of rows) byMid.set(r.mid, [...(byMid.get(r.mid) ?? []), r]);
  const out = new Map<string, MerchantActivity>();
  for (const [mid, rs] of byMid) {
    const recent = rs.some((r) => r.recent > 0);
    const used = recent ? rs.filter((r) => r.recent > 0) : rs;
    out.set(mid, {
      recent,
      count: used.reduce((a, r) => a + (recent ? r.recent : r.n), 0),
      totals: used.map((r) => ({ currency: r.currency, amount_minor: recent ? r.recent_amount : r.amount }))
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
  const row = (await listMerchants()).find((m) => m.id === id);
  if (!row) return null;
  const db = await getDb();
  // spent there: purchases / payments minus refunds not settled on a purchase (a settled one already reduced it)
  const totals = await db.all<{ currency: string; amount_minor: number }>(
    `SELECT currency, sum(CASE WHEN t.kind = 'refund' THEN -amount_minor ELSE amount_minor END) AS amount_minor FROM transactions t
      WHERE t.merchant_key = ? AND (t.kind IN ${KINDS} OR (t.kind = 'refund' AND t.refund_settled_at IS NULL))
      GROUP BY currency HAVING sum(CASE WHEN t.kind = 'refund' THEN -amount_minor ELSE amount_minor END) != 0
      ORDER BY amount_minor DESC`, [id]);
  return { ...row, totals };
}

/**
 * Sets (or with null removes) a merchant's category. Setting it also changes the merchant's transactions that
 * follow it (not the manual choices). Removing it changes no transaction: new ones just arrive without one.
 */
export async function setMerchantCategory(id: string, categoryId: number | null) {
  const db = await getDb();
  // one category of its own: no longer of different ones
  await db.run('DELETE FROM mixed_merchants WHERE merchant_key = ?', [id]);
  if (categoryId === null) {
    await db.run("DELETE FROM merchant_rules WHERE match_type = 'exact' AND pattern = ?", [id]);
    return;
  }
  await createRule('exact', id, categoryId);
  await backfillRule('exact', id, categoryId);
}

/**
 * Marks a merchant as of different categories (on) or not (off). On: its category goes, its operations keep theirs
 * (those that followed it become their own), each new one asks. Off: new operations just arrive without a category
 * until one is picked for the merchant.
 */
export async function setMerchantMixed(id: string, on: boolean) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (!on) { await tx.run('DELETE FROM mixed_merchants WHERE merchant_key = ?', [id]); return; }
    await tx.run('INSERT OR IGNORE INTO mixed_merchants (merchant_key, created_at) VALUES (?, ?)', [id, Math.floor(Date.now() / 1000)]);
    await tx.run("DELETE FROM merchant_rules WHERE match_type = 'exact' AND pattern = ?", [id]);
    await tx.run("UPDATE transactions SET category_source = 'user' WHERE merchant_key = ? AND category_source = 'rule'", [id]);
  });
}

/** The categories a merchant's purchases / payments had (live ones), the most used first: what its new ones offer. */
export async function merchantCategories(id: string, limit = 10): Promise<Array<{ id: number; name: string; emoji: string | null; type_name: string | null; n: number }>> {
  const db = await getDb();
  return db.all(
    `SELECT c.id, c.name, c.emoji, ct.name AS type_name, count(*) AS n FROM transactions t
      JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
      LEFT JOIN category_types ct ON ct.id = c.type_id
      WHERE t.merchant_key = ? AND t.kind IN ${KINDS}
      GROUP BY c.id ORDER BY n DESC, max(t.occurred_at) DESC LIMIT ?`, [id, limit]);
}

/**
 * What giving several merchants one category changes: their operations that follow them (not the manual choices)
 * whose category isn't it yet — count, and per currency the total, the biggest first.
 */
export async function merchantsCategoryPreview(keys: string[], categoryId: number): Promise<{ count: number; totals: Array<{ currency: string; amount_minor: number }> }> {
  const sums = new Map<string, number>();
  let count = 0;
  for (const k of keys) {
    for (const t of await categoryChangeTotals(k, categoryId)) {
      count += t.n;
      sums.set(t.currency, (sums.get(t.currency) ?? 0) + t.amount_minor);
    }
  }
  return {
    count,
    totals: [...sums].map(([currency, amount_minor]) => ({ currency, amount_minor })).sort((a, b) => b.amount_minor - a.amount_minor),
  };
}

/** One category for several merchants (see setMerchantCategory): their new and following operations get it. */
export async function setMerchantsCategory(keys: string[], categoryId: number) {
  for (const k of keys) await setMerchantCategory(k, categoryId);
}

/**
 * Deletes merchants: their operations stay with their categories but without a merchant (a category one had from
 * the merchant becomes its own, as if picked by hand, so nothing moves in the stats); the merchants' categories go.
 * A new SMS from a deleted shop creates the merchant again. Returns how many operations lost their merchant.
 */
export async function deleteMerchants(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const db = await getDb();
  let changed = 0;
  await db.transaction(async (tx) => {
    for (const key of keys) {
      const res = await tx.run(
        `UPDATE transactions SET merchant_key = NULL, raw_merchant = NULL,
            category_source = CASE WHEN category_id IS NULL THEN NULL ELSE 'user' END
          WHERE merchant_key = ?`, [key]);
      changed += res.changes;
      await tx.run("DELETE FROM merchant_rules WHERE match_type = 'exact' AND pattern = ?", [key]);
      await tx.run('DELETE FROM mixed_merchants WHERE merchant_key = ?', [key]);
    }
  });
  return changed;
}

export default { listMerchants, getMerchant, setMerchantCategory, setMerchantMixed, merchantCategories, setMerchantsCategory, merchantsCategoryPreview, deleteMerchants };
