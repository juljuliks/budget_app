import { REMEMBERABLE_KINDS } from './types';
import { getDb } from './db';

export type MatchType = 'exact' | 'prefix';

export async function findCategoryForMerchant(merchantKey: string): Promise<{ category_id: number; source: 'rule' } | null> {
  const db = await getDb();
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

export async function createRule(matchType: MatchType, pattern: string, categoryId: number) {
  const db = await getDb();
  await db.run(
    'INSERT OR REPLACE INTO merchant_rules (match_type, pattern, category_id, created_at) VALUES (?, ?, ?, ?)',
    [matchType, pattern, categoryId, Math.floor(Date.now() / 1000)]);
}

/** Forgets a merchant: new transactions from it will ask for a category again. */
export async function deleteRule(matchType: MatchType, pattern: string) {
  const db = await getDb();
  await db.run('DELETE FROM merchant_rules WHERE match_type = ? AND pattern = ?', [matchType, pattern]);
}

/**
 * Applies a rule to existing transactions. Only touches uncategorized or rule-assigned
 * ones, so manual (category_source = 'user') choices are never overwritten. Only purchases / payments
 * (see isRememberable).
 */
export async function backfillRule(matchType: MatchType, pattern: string, categoryId: number) {
  const db = await getDb();
  // substr comparison instead of LIKE so '%' / '_' in merchant names aren't wildcards
  const [match, matchParams] = matchType === 'exact'
    ? ['merchant_key = ?', [pattern]]
    : ['substr(merchant_key, 1, length(?)) = ?', [pattern, pattern]];
  const res = await db.run(
    `UPDATE transactions SET category_id = ?, category_source = 'rule'
      WHERE ${match} AND kind IN (${REMEMBERABLE_KINDS.map((k) => `'${k}'`).join(',')})
        AND (category_id IS NULL OR category_source = 'rule')`,
    [categoryId, ...matchParams]);
  return res.changes;
}

export default { findCategoryForMerchant, createRule, deleteRule, backfillRule };
