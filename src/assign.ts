import { getDb } from './db';
import { setCategoryForTransactions, setTransactionCategory } from './db/transactions';
import { incrementCategoryUsage } from './db/categories';
import { createRule, backfillRule, deleteRule } from './categorize';
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
    const tx = await db.get<{ kind: string; merchant_key: string | null }>('SELECT kind, merchant_key FROM transactions WHERE id = ?', [txId]);
    if (tx?.merchant_key && isRememberable(tx.kind)) {
      if (applyToMerchant) {
        await createRule('exact', tx.merchant_key, categoryId);
        await backfillRule('exact', tx.merchant_key, categoryId);
      } else {
        // "Запомнить" switched off: forget an earlier choice too, or it would keep categorizing this merchant
        await deleteRule('exact', tx.merchant_key);
      }
    }
    await incrementCategoryUsage(categoryId);
  }
  emitTransactionsChanged();
}

export default assignCategory;

/** Same category (null = none) for several transactions (bulk edit from the list). No merchant rules: a one-off manual choice. */
export async function assignCategoryToMany(txIds: number[], categoryId: number | null) {
  if (txIds.length === 0) return;
  await setCategoryForTransactions(txIds, categoryId);
  if (categoryId !== null) await incrementCategoryUsage(categoryId);
  emitTransactionsChanged();
}
