import { getDb } from './db';
import { setCategoryForTransactions, setTransactionCategory } from './db/transactions';
import { incrementCategoryUsage } from './db/categories';
import { createRule, backfillRule, findCategoryForMerchant, isMixedMerchant } from './categorize';
import { emitTransactionsChanged } from './events';
import { isRememberable, REMEMBERABLE_KINDS } from './types';

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
  // a merchant of different categories has none of its own: a pick is always this operation's
  const key = tx?.merchant_key && isRememberable(tx.kind) && !(await isMixedMerchant(tx.merchant_key)) ? tx.merchant_key : null;
  const forMerchant = categoryId !== null && key !== null
    && (choice === 'merchant' || (choice === undefined && !(await findCategoryForMerchant(key))));

  if (forMerchant) {
    await createRule('exact', key!, categoryId!);
    // this one follows the merchant from now on, like the ones the rule picked
    await setTransactionCategory(txId, categoryId, 'rule');
    await backfillRule('exact', key!, categoryId!);
  } else {
    await setTransactionCategory(txId, categoryId, 'user');
  }
  if (categoryId !== null) await incrementCategoryUsage(categoryId);
  emitTransactionsChanged();
}

export default assignCategory;

export type MerchantChange = {
  merchant: string;
  /** its merchant_key */
  key: string;
  /** the merchant's category now, null = none yet */
  fromCategoryId: number | null;
  /** transactions whose category changes if the new one becomes the merchant's (this one included) */
  count: number;
  totals: Array<{ currency: string; amount_minor: number }>;
};

/**
 * Picking `categoryId` for a purchase / payment whose merchant has another category or none yet: what making it
 * the merchant's category would change (asked before changing: this one only or the merchant). null = nothing to
 * ask (no merchant, "Без категории", or already the merchant's category).
 */
export async function merchantChangePreview(txId: number, categoryId: number | null): Promise<MerchantChange | null> {
  if (categoryId === null) return null;
  const db = await getDb();
  const tx = await db.get<{ kind: string; merchant_key: string | null; raw_merchant: string | null }>(
    'SELECT kind, merchant_key, raw_merchant FROM transactions WHERE id = ?', [txId]);
  if (!tx?.merchant_key || !isRememberable(tx.kind)) return null;
  // of different categories: nothing to ask, the pick is this operation's
  if (await isMixedMerchant(tx.merchant_key)) return null;
  const rule = await findCategoryForMerchant(tx.merchant_key);
  if (rule?.category_id === categoryId) return null;
  const totals = await categoryChangeTotals(tx.merchant_key, categoryId, txId);
  return {
    merchant: tx.raw_merchant || tx.merchant_key,
    key: tx.merchant_key,
    fromCategoryId: rule?.category_id ?? null,
    count: totals.reduce((s, t) => s + t.n, 0),
    totals: totals.map(({ currency, amount_minor }) => ({ currency, amount_minor })),
  };
}

/**
 * What a merchant's transactions would change if `categoryId` became its category: the same rows backfillRule
 * touches (plus `alsoTxId`), only those whose category really changes. Per currency, the biggest first.
 */
export async function categoryChangeTotals(merchantKey: string, categoryId: number, alsoTxId = -1) {
  const db = await getDb();
  return db.all<{ currency: string; amount_minor: number; n: number }>(
    `SELECT currency, sum(CASE WHEN kind = 'refund' THEN -amount_minor ELSE amount_minor END) AS amount_minor, count(*) AS n FROM transactions
      WHERE merchant_key = ?
        AND (kind IN (${REMEMBERABLE_KINDS.map(() => '?').join(',')}) OR (kind = 'refund' AND refund_settled_at IS NULL))
        AND (id = ? OR category_source IS NULL OR category_source = 'rule')
        AND (category_id IS NULL OR category_id != ?)
      GROUP BY currency ORDER BY sum(CASE WHEN kind = 'refund' THEN -amount_minor ELSE amount_minor END) DESC`,
    [merchantKey, ...REMEMBERABLE_KINDS, alsoTxId, categoryId]);
}

/** The merchants of these transactions whose category `categoryId` would change (purchases / payments only). */
async function merchantsToChange(txIds: number[], categoryId: number): Promise<Array<{ key: string; name: string }>> {
  if (txIds.length === 0) return [];
  const db = await getDb();
  const rows = await db.all<{ kind: string; merchant_key: string | null; raw_merchant: string | null }>(
    `SELECT kind, merchant_key, raw_merchant FROM transactions WHERE id IN (${txIds.map(() => '?').join(',')})`, txIds);
  const out = new Map<string, string>();
  for (const r of rows) {
    if (!r.merchant_key || !isRememberable(r.kind) || out.has(r.merchant_key) || await isMixedMerchant(r.merchant_key)) continue;
    const rule = await findCategoryForMerchant(r.merchant_key);
    if (rule?.category_id !== categoryId) out.set(r.merchant_key, r.raw_merchant || r.merchant_key);
  }
  return [...out].map(([key, name]) => ({ key, name }));
}

export type MerchantsChange = {
  merchants: string[];
  /** transactions whose category changes if it becomes those merchants' (the selected ones included) */
  count: number;
  totals: Array<{ currency: string; amount_minor: number }>;
};

/**
 * Bulk edit: what making `categoryId` the category of the selected transactions' merchants would change — asked
 * like for one transaction (these only or the merchants too). null = nothing to ask (no merchant to change).
 */
export async function merchantsChangePreview(txIds: number[], categoryId: number | null): Promise<MerchantsChange | null> {
  if (categoryId === null) return null;
  const merchants = await merchantsToChange(txIds, categoryId);
  if (merchants.length === 0) return null;
  const sums = new Map<string, number>();
  let count = 0;
  for (const m of merchants) {
    for (const t of await categoryChangeTotals(m.key, categoryId)) {
      sums.set(t.currency, (sums.get(t.currency) ?? 0) + t.amount_minor);
      count += t.n;
    }
  }
  return {
    merchants: merchants.map((m) => m.name),
    count,
    totals: [...sums].map(([currency, amount_minor]) => ({ currency, amount_minor })).sort((a, b) => b.amount_minor - a.amount_minor),
  };
}

/**
 * Same category (null = none) for several transactions (bulk edit from the list). By default a one-off manual
 * choice; 'merchant' also makes it their merchants' category (rule + the merchants' transactions that follow it),
 * the selected ones of those merchants then follow it too. Returns how many merchants got it.
 */
export async function assignCategoryToMany(txIds: number[], categoryId: number | null, choice?: MerchantChoice): Promise<number> {
  if (txIds.length === 0) return 0;
  const merchants = categoryId !== null && choice === 'merchant' ? await merchantsToChange(txIds, categoryId) : [];
  await setCategoryForTransactions(txIds, categoryId);
  for (const m of merchants) {
    await createRule('exact', m.key, categoryId!);
    await backfillRule('exact', m.key, categoryId!);
  }
  if (merchants.length > 0) {
    // the selected ones of these merchants follow them from now on, like the ones the rule picked
    const db = await getDb();
    await db.run(
      `UPDATE transactions SET category_source = 'rule' WHERE id IN (${txIds.map(() => '?').join(',')})
        AND merchant_key IN (${merchants.map(() => '?').join(',')}) AND kind IN (${REMEMBERABLE_KINDS.map(() => '?').join(',')})`,
      [...txIds, ...merchants.map((m) => m.key), ...REMEMBERABLE_KINDS]);
  }
  if (categoryId !== null) await incrementCategoryUsage(categoryId);
  emitTransactionsChanged();
  return merchants.length;
}
