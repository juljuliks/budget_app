import { getDb } from './db';
import { setCategoryForTransactions, setTransactionCategory } from './db/transactions';
import { incrementCategoryUsage } from './db/categories';
import { createRule, backfillRule, findCategoryForMerchant } from './categorize';
import { emitTransactionsChanged } from './events';
import { isRememberable, REMEMBERABLE_KINDS } from './types';
import { groupIdOf, merchantIdOf, merchantIdSql } from './db/merchantId';

/**
 * What a merchant rule is for: it picks the category of the merchant's new transactions automatically.
 * Any transaction can still get another category of its own ('only'). 'merchant' makes the category the
 * merchant's: the rule changes and so do the merchant's transactions that follow it (category_source
 * 'rule' or none yet); manual choices stay. Without `merchant`, the category becomes the merchant's only
 * if it has none yet (first pick, notification buttons).
 */
export type MerchantChoice = 'merchant' | 'only';

export async function assignCategory(txId: number, categoryId: number | null, choice?: MerchantChoice) {
  const db = await getDb();
  const tx = await db.get<{ kind: string; merchant_key: string | null }>(
    'SELECT kind, merchant_key FROM transactions WHERE id = ?', [txId]);
  // only purchases / payments are remembered: a transfer or deposit "merchant" is a person or the card
  const key = tx?.merchant_key && isRememberable(tx.kind) ? tx.merchant_key : null;
  const forMerchant = categoryId !== null && key !== null
    && (choice === 'merchant' || (choice === undefined && !(await findCategoryForMerchant(key))));

  if (forMerchant) {
    // keyed by the merchant id: a merchant in a group sets the group's category
    const id = await merchantIdOf(key!);
    await createRule('exact', id, categoryId!);
    // this one follows the merchant from now on, like the ones the rule picked
    await setTransactionCategory(txId, categoryId, 'rule');
    await backfillRule('exact', id, categoryId!);
  } else {
    await setTransactionCategory(txId, categoryId, 'user');
  }
  if (categoryId !== null) await incrementCategoryUsage(categoryId);
  emitTransactionsChanged();
}

export default assignCategory;

export type MerchantChange = {
  merchant: string;
  /** the merchant's category now */
  fromCategoryId: number;
  /** transactions whose category changes if the new one becomes the merchant's (this one included) */
  count: number;
  totals: Array<{ currency: string; amount_minor: number }>;
};

/**
 * Picking `categoryId` for a transaction whose merchant already has another category: what making it the
 * merchant's category would change (asked before changing). null = nothing to ask.
 */
export async function merchantChangePreview(txId: number, categoryId: number | null): Promise<MerchantChange | null> {
  if (categoryId === null) return null;
  const db = await getDb();
  const tx = await db.get<{ kind: string; merchant_key: string | null; raw_merchant: string | null }>(
    'SELECT kind, merchant_key, raw_merchant FROM transactions WHERE id = ?', [txId]);
  if (!tx?.merchant_key || !isRememberable(tx.kind)) return null;
  const rule = await findCategoryForMerchant(tx.merchant_key);
  if (!rule || rule.category_id === categoryId) return null;
  const id = await merchantIdOf(tx.merchant_key);
  const totals = await categoryChangeTotals(id, categoryId, txId);
  const groupId = groupIdOf(id);
  const group = groupId === null ? undefined : await db.get<{ name: string }>('SELECT name FROM merchant_groups WHERE id = ?', [groupId]);
  return {
    merchant: group?.name ?? (tx.raw_merchant || tx.merchant_key),
    fromCategoryId: rule.category_id,
    count: totals.reduce((s, t) => s + t.n, 0),
    totals: totals.map(({ currency, amount_minor }) => ({ currency, amount_minor })),
  };
}

/**
 * What a merchant's transactions would change if `categoryId` became its category: the same rows backfillRule
 * touches (plus `alsoTxId`), only those whose category really changes. Per currency, the biggest first.
 */
export async function categoryChangeTotals(merchantId: string, categoryId: number, alsoTxId = -1) {
  const db = await getDb();
  return db.all<{ currency: string; amount_minor: number; n: number }>(
    `SELECT currency, sum(CASE WHEN kind = 'refund' THEN -amount_minor ELSE amount_minor END) AS amount_minor, count(*) AS n FROM transactions
      WHERE ${merchantIdSql('transactions')} = ?
        AND (kind IN (${REMEMBERABLE_KINDS.map(() => '?').join(',')}) OR (kind = 'refund' AND refund_settled_at IS NULL))
        AND (id = ? OR category_source IS NULL OR category_source = 'rule')
        AND (category_id IS NULL OR category_id != ?)
      GROUP BY currency ORDER BY sum(CASE WHEN kind = 'refund' THEN -amount_minor ELSE amount_minor END) DESC`,
    [merchantId, ...REMEMBERABLE_KINDS, alsoTxId, categoryId]);
}

/** Same category (null = none) for several transactions (bulk edit from the list). No merchant rules: a one-off manual choice. */
export async function assignCategoryToMany(txIds: number[], categoryId: number | null) {
  if (txIds.length === 0) return;
  await setCategoryForTransactions(txIds, categoryId);
  if (categoryId !== null) await incrementCategoryUsage(categoryId);
  emitTransactionsChanged();
}
