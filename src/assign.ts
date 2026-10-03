import { getDb } from './db';
import { setCategoryForTransactions, setMerchantDetached, setTransactionCategory } from './db/transactions';
import { incrementCategoryUsage } from './db/categories';
import { createRule, backfillRule, findCategoryForMerchant } from './categorize';
import { emitTransactionsChanged } from './events';
import { isRememberable } from './types';

/**
 * User picked a category for a transaction. Optionally remembers it for the merchant:
 * creates an exact rule and applies it to the merchant's uncategorized / rule-assigned transactions.
 * Only for purchases / payments (isRememberable): a transfer or deposit "merchant" is a person or the card.
 */
export async function assignCategory(txId: number, categoryId: number | null, opts: { applyToMerchant?: boolean } = {}) {
  const { applyToMerchant = true } = opts;
  await setTransactionCategory(txId, categoryId, 'user');

  if (categoryId !== null) {
    const db = await getDb();
    const tx = await db.get<{ kind: string; merchant_key: string | null; merchant_detached: number }>(
      'SELECT kind, merchant_key, merchant_detached FROM transactions WHERE id = ?', [txId]);
    // switched off or detached ("обработать иначе"): the category is for this transaction only
    if (applyToMerchant && tx?.merchant_key && isRememberable(tx.kind) && !tx.merchant_detached) {
      await createRule('exact', tx.merchant_key, categoryId);
      await backfillRule('exact', tx.merchant_key, categoryId);
    }
    await incrementCategoryUsage(categoryId);
  }
  emitTransactionsChanged();
}

export default assignCategory;

/**
 * "Вернуть мерчанта для этой транзакции": back under the merchant's rule, so it takes the rule's category
 * (the one picked while detached was for this transaction only).
 */
export async function reattachMerchant(txId: number) {
  await setMerchantDetached(txId, false);
  const db = await getDb();
  const tx = await db.get<{ kind: string; merchant_key: string | null }>(
    'SELECT kind, merchant_key FROM transactions WHERE id = ?', [txId]);
  if (tx?.merchant_key && isRememberable(tx.kind)) {
    // the rule can be gone only if its category was deleted ("Оставить без категории"): the merchant has none
    const rule = await findCategoryForMerchant(tx.merchant_key);
    await setTransactionCategory(txId, rule?.category_id ?? null, 'rule');
  }
  emitTransactionsChanged();
}

/** Same category (null = none) for several transactions (bulk edit from the list). No merchant rules: a one-off manual choice. */
export async function assignCategoryToMany(txIds: number[], categoryId: number | null) {
  if (txIds.length === 0) return;
  await setCategoryForTransactions(txIds, categoryId);
  if (categoryId !== null) await incrementCategoryUsage(categoryId);
  emitTransactionsChanged();
}
