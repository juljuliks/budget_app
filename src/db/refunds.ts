import { getDb } from './index';
import type { Db } from './types';
import { REMEMBERABLE_KINDS } from '../domain/types';
import { findCategoryForMerchant } from '../categorize/rules';
import { sqlList } from './sql';

/** How far back a refund looks for a purchase at its merchant to take the category from. */
export const REFUND_LOOKBACK_DAYS = 90;

export type Refund = {
  id: number;
  amount_minor: number;
  currency: string;
  raw_merchant: string | null;
  merchant_key: string | null;
  occurred_at: number;
  refund_settled_at: number | null;
  refund_target_id: number | null;
};

export async function getRefund(id: number): Promise<Refund | undefined> {
  const db = await getDb();
  return db.get<Refund>(
    `SELECT id, amount_minor, currency, raw_merchant, merchant_key, occurred_at, refund_settled_at, refund_target_id
      FROM transactions WHERE id = ? AND kind = 'refund'`, [id]);
}

/**
 * The category a refund is subtracted from: the merchant's category (its rule, or the primary one of a merchant of
 * different categories), else the category of the latest purchase / payment at that merchant within
 * REFUND_LOOKBACK_DAYS before it; null when unknown (counted as "Возвраты без категории").
 */
export async function refundCategory(merchantKey: string | null | undefined, occurredAt: number, db?: Db): Promise<number | null> {
  if (!merchantKey) return null;
  db ??= await getDb();
  const rule = await findCategoryForMerchant(merchantKey, db);
  if (rule) return rule.category_id;
  const last = await db.get<{ category_id: number }>(
    `SELECT category_id FROM transactions
      WHERE merchant_key = ? AND kind IN (${sqlList(REMEMBERABLE_KINDS)})
        AND category_id IS NOT NULL AND occurred_at >= ? AND occurred_at <= ?
      ORDER BY occurred_at DESC, id DESC LIMIT 1`,
    [merchantKey, occurredAt - REFUND_LOOKBACK_DAYS * 86400, occurredAt]);
  return last?.category_id ?? null;
}

/** refundCategory in SQL, for the refund row `transactions` being updated. */
const REFUND_CATEGORY_SQL = `coalesce(
    CASE WHEN EXISTS (SELECT 1 FROM mixed_merchants m WHERE m.merchant_key = transactions.merchant_key) THEN (
      SELECT mc.category_id FROM merchant_categories mc
        JOIN categories c ON c.id = mc.category_id AND c.deleted_at IS NULL
        WHERE mc.merchant_key = transactions.merchant_key ORDER BY mc.position, mc.category_id LIMIT 1)
    ELSE coalesce(
      (SELECT category_id FROM merchant_rules WHERE match_type = 'exact' AND pattern = transactions.merchant_key),
      (SELECT category_id FROM merchant_rules WHERE match_type = 'prefix' AND substr(transactions.merchant_key, 1, length(pattern)) = pattern
        ORDER BY length(pattern) DESC LIMIT 1)) END,
    (SELECT p.category_id FROM transactions p
      WHERE p.merchant_key = transactions.merchant_key AND p.kind IN (${sqlList(REMEMBERABLE_KINDS)})
        AND p.category_id IS NOT NULL AND p.occurred_at >= transactions.occurred_at - ${REFUND_LOOKBACK_DAYS * 86400} AND p.occurred_at <= transactions.occurred_at
      ORDER BY p.occurred_at DESC, p.id DESC LIMIT 1))`;

/** Refunds that came before refundCategory (or before their merchant got a category) get one now, in one statement. Idempotent. */
export async function autoCategorizeRefunds(): Promise<number> {
  const db = await getDb();
  const { changes } = await db.run(
    `UPDATE transactions SET category_id = ${REFUND_CATEGORY_SQL}, category_source = 'rule'
      WHERE kind = 'refund' AND category_id IS NULL AND category_source IS NULL AND refund_settled_at IS NULL
        AND merchant_key IS NOT NULL AND ${REFUND_CATEGORY_SQL} IS NOT NULL`);
  return changes;
}

export default { getRefund, refundCategory, autoCategorizeRefunds };
