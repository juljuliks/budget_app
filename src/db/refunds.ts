import { getDb } from './index';
import { merchantIdOf, merchantIdSql } from './merchantId';
import { REMEMBERABLE_KINDS } from '../types';
import { findCategoryForMerchant } from '../categorize';

/** How far back a refund looks for the purchase it belongs to. */
export const REFUND_LOOKBACK_DAYS = 90;

export type RefundCandidate = {
  id: number;
  kind: string;
  amount_minor: number;
  currency: string;
  raw_merchant: string | null;
  occurred_at: number;
  /** same amount as the refund: most likely the purchase being refunded */
  same_amount: boolean;
};

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
 * Purchases / payments at the refund's merchant in the last REFUND_LOOKBACK_DAYS (and after it, in case the
 * purchase SMS came late), in the refund's currency. Same amount first, then newest first.
 */
export async function refundCandidates(refundId: number): Promise<RefundCandidate[]> {
  const refund = await getRefund(refundId);
  if (!refund?.merchant_key) return [];
  const db = await getDb();
  const rows = await db.all<Omit<RefundCandidate, 'same_amount'>>(
    `SELECT id, kind, amount_minor, currency, raw_merchant, occurred_at FROM transactions
      WHERE ${merchantIdSql('transactions')} = ? AND currency = ? AND kind IN (${REMEMBERABLE_KINDS.map((k) => `'${k}'`).join(',')})
        AND occurred_at >= ?
      ORDER BY amount_minor = ? DESC, occurred_at DESC, id DESC`,
    [await merchantIdOf(refund.merchant_key), refund.currency, refund.occurred_at - REFUND_LOOKBACK_DAYS * 86400, refund.amount_minor]);
  return rows.map((r) => ({ ...r, same_amount: r.amount_minor === refund.amount_minor }));
}

async function markSettled(refundId: number, targetId: number) {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  await db.run(
    'UPDATE transactions SET refund_settled_at = ?, refund_target_id = ?, seen_at = coalesce(seen_at, ?) WHERE id = ?',
    [now, targetId, now, refundId]);
}

/** The purchase becomes cheaper by the refunded amount. Refused when the refund covers it all (delete instead). */
export async function reducePurchaseByRefund(refundId: number, purchaseId: number) {
  const refund = await getRefund(refundId);
  if (!refund) throw new Error('refund not found');
  const db = await getDb();
  await db.transaction(async () => {
    const { changes } = await db.run(
      'UPDATE transactions SET amount_minor = amount_minor - ? WHERE id = ? AND amount_minor > ?',
      [refund.amount_minor, purchaseId, refund.amount_minor]);
    if (changes === 0) throw new Error('refund covers the whole purchase');
    await markSettled(refundId, purchaseId);
  });
}

/** The whole purchase was refunded: it disappears from history and stats. */
export async function deletePurchaseByRefund(refundId: number, purchaseId: number) {
  const db = await getDb();
  await db.transaction(async () => {
    await db.run('DELETE FROM transactions WHERE id = ?', [purchaseId]);
    await markSettled(refundId, purchaseId);
  });
}

/**
 * The category a refund is subtracted from until it is settled on its purchase: the merchant's category (its rule),
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

export default { getRefund, refundCandidates, reducePurchaseByRefund, deletePurchaseByRefund, refundCategory, autoCategorizeRefunds };
