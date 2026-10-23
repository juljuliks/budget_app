import { getDb } from '../db';
import type { Db } from '../db/types';
import { merchantSpendingSql } from '../db/spending';

export type MatchType = 'exact' | 'prefix';

/** A merchant of different categories: a list, the first of it its primary category (see mixed_merchants). */
export async function isMixedMerchant(merchantKey: string, db?: Db): Promise<boolean> {
  db ??= await getDb();
  return !!(await db.get('SELECT 1 FROM mixed_merchants WHERE merchant_key = ?', [merchantKey]));
}

/**
 * The merchant's category, by the transaction's merchant_key. A merchant of different categories has its primary one:
 * the first of its list (a new operation gets it; a notification still asks, and a pick does not change this).
 */
export async function findCategoryForMerchant(merchantKey: string, db?: Db): Promise<{ category_id: number; source: 'rule' } | null> {
  db ??= await getDb();
  if (await isMixedMerchant(merchantKey, db)) {
    const first = await db.get<{ category_id: number }>(
      `SELECT mc.category_id FROM merchant_categories mc
        JOIN categories c ON c.id = mc.category_id AND c.deleted_at IS NULL
        WHERE mc.merchant_key = ? ORDER BY mc.position, mc.category_id LIMIT 1`, [merchantKey]);
    return first ? { category_id: first.category_id, source: 'rule' } : null;
  }
  const exact = await db.get<{ category_id: number }>(
    'SELECT category_id FROM merchant_rules WHERE match_type = ? AND pattern = ?', ['exact', merchantKey]);
  if (exact) return { category_id: exact.category_id, source: 'rule' };

  // prefix: the longest matching pattern wins
  const prefix = await db.get<{ category_id: number }>(
    `SELECT category_id FROM merchant_rules
      WHERE match_type = 'prefix' AND substr(?, 1, length(pattern)) = pattern
      ORDER BY length(pattern) DESC LIMIT 1`, [merchantKey]);
  if (prefix) return { category_id: prefix.category_id, source: 'rule' };
  return null;
}

/** `db`: the transaction's handle when called inside one (getDb() there would wait for the transaction to end). */
export async function createRule(matchType: MatchType, pattern: string, categoryId: number, db?: Db) {
  db ??= await getDb();
  await db.run(
    'INSERT OR REPLACE INTO merchant_rules (match_type, pattern, category_id, created_at) VALUES (?, ?, ?, ?)',
    [matchType, pattern, categoryId, Math.floor(Date.now() / 1000)]);
}

/**
 * Applies a rule to existing transactions (exact: `pattern` is a merchant_key). Only touches uncategorized or rule-assigned
 * ones, so manual (category_source = 'user', "Без категории" included) choices are never overwritten. Only purchases / payments
 * (see isRememberable).
 */
export async function backfillRule(matchType: MatchType, pattern: string, categoryId: number, db?: Db) {
  db ??= await getDb();
  // substr comparison instead of LIKE so '%' / '_' in merchant names aren't wildcards
  const [match, matchParams] = matchType === 'exact'
    ? ['merchant_key = ?', [pattern]]
    : ['substr(merchant_key, 1, length(?)) = ?', [pattern, pattern]];
  const res = await db.run(
    // purchases / payments, and refunds not settled on a purchase (they are subtracted from the merchant's category)
    `UPDATE transactions SET category_id = ?, category_source = 'rule'
      WHERE ${match}
        AND ${merchantSpendingSql()}
        AND (category_source IS NULL OR category_source = 'rule')`,
    [categoryId, ...matchParams]);
  return res.changes;
}

export default { findCategoryForMerchant, isMixedMerchant, createRule, backfillRule };
