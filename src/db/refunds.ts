import { getDb } from './index';
import { merchantIdOf, merchantIdSql } from './merchantId';
import { REMEMBERABLE_KINDS } from '../types';
import { findCategoryForMerchant } from '../categorize';

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
 * The category a refund is subtracted from: the merchant's category (its rule),
 * else the category of the latest purchase / payment at that merchant within REFUND_LOOKBACK_DAYS before it; null
 * when unknown (counted as "Возвраты без категории").
 */
export async function refundCategory(merchantKey: string | null | undefined, occurredAt: number): Promise<number | null> {
  if (!merchantKey) return null;
  const rule = await findCategoryForMerchant(merchantKey);
  if (rule) return rule.category_id;
  const db = await getDb();
  const last = await db.get<{ category_id: number }>(
    `SELECT category_id FROM transactions
      WHERE ${merchantIdSql('transactions')} = ? AND kind IN (${REMEMBERABLE_KINDS.map((k) => `'${k}'`).join(',')})
        AND category_id IS NOT NULL AND occurred_at >= ? AND occurred_at <= ?
      ORDER BY occurred_at DESC, id DESC LIMIT 1`,
    [await merchantIdOf(merchantKey), occurredAt - REFUND_LOOKBACK_DAYS * 86400, occurredAt]);
  return last?.category_id ?? null;
}

/** Refunds that came before refundCategory (or before their merchant got a category) get one now. Idempotent. */
export async function autoCategorizeRefunds(): Promise<number> {
  const db = await getDb();
  const rows = await db.all<{ id: number; merchant_key: string | null; occurred_at: number }>(
    `SELECT id, merchant_key, occurred_at FROM transactions
      WHERE kind = 'refund' AND category_id IS NULL AND category_source IS NULL AND refund_settled_at IS NULL`);
  let n = 0;
  for (const r of rows) {
    const categoryId = await refundCategory(r.merchant_key, r.occurred_at);
    if (categoryId === null) continue;
    await db.run("UPDATE transactions SET category_id = ?, category_source = 'rule' WHERE id = ? AND category_id IS NULL", [categoryId, r.id]);
    n++;
  }
  return n;
}

export default { getRefund, refundCategory, autoCategorizeRefunds };
