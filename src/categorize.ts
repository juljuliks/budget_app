import { REMEMBERABLE_KINDS } from './types';
import { getDb } from './db';
import { merchantIdOf, merchantIdSql } from './db/merchantId';

export type MatchType = 'exact' | 'prefix';

/** The merchant's category, by the transaction's merchant_key (a merchant in a group has the group's). */
export async function findCategoryForMerchant(merchantKey: string): Promise<{ category_id: number; source: 'rule' } | null> {
  const db = await getDb();
  // exact rules are keyed by the merchant id (the group's for a merchant in a group)
  const exact = await db.get<{ category_id: number }>(
    'SELECT category_id FROM merchant_rules WHERE match_type = ? AND pattern = ?', ['exact', await merchantIdOf(merchantKey)]);
  if (exact) return { category_id: exact.category_id, source: 'rule' };

  // prefix: the longest matching pattern wins
  const prefix = await db.get<{ category_id: number }>(
    `SELECT category_id FROM merchant_rules
      WHERE match_type = 'prefix' AND substr(?, 1, length(pattern)) = pattern
      ORDER BY length(pattern) DESC LIMIT 1`, [merchantKey]);
  if (prefix) return { category_id: prefix.category_id, source: 'rule' };
  return null;
}

export async function createRule(matchType: MatchType, pattern: string, categoryId: number) {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO merchant_rules (match_type, pattern, category_id, created_at) VALUES (?, ?, ?, ?)',
    [matchType, pattern, categoryId, Math.floor(Date.now() / 1000)]);
}

/**
 * Applies a rule to existing transactions (exact: `pattern` is a merchant id, see merchantId.ts). Only touches uncategorized or rule-assigned
 * ones, so manual (category_source = 'user', "Без категории" included) choices are never overwritten. Only purchases / payments
 * (see isRememberable).
 */
export async function backfillRule(matchType: MatchType, pattern: string, categoryId: number) {
  const db = await getDb();
  // substr comparison instead of LIKE so '%' / '_' in merchant names aren't wildcards
  const [match, matchParams] = matchType === 'exact'
    ? [`${merchantIdSql('transactions')} = ?`, [pattern]]
    : ['substr(merchant_key, 1, length(?)) = ?', [pattern, pattern]];
  const res = await db.run(
    // purchases / payments, and refunds not settled on a purchase (they are subtracted from the merchant's category)
    `UPDATE transactions SET category_id = ?, category_source = 'rule'
      WHERE ${match}
        AND (kind IN (${REMEMBERABLE_KINDS.map((k) => `'${k}'`).join(',')}) OR (kind = 'refund' AND refund_settled_at IS NULL))
        AND (category_source IS NULL OR category_source = 'rule')`,
    [categoryId, ...matchParams]);
  return res.changes;
}

export default { findCategoryForMerchant, createRule, backfillRule };
