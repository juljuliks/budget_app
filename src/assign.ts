import { getDb } from './db';
import { setCategoryForTransactions, setTransactionCategory } from './db/transactions';
import { incrementCategoryUsage } from './db/categories';
import { createRule, backfillRule } from './categorize';
import { emitTransactionsChanged } from './events';

/**
 * User picked a category for a transaction. Optionally remembers it for the merchant:
 * creates an exact rule and applies it to the merchant's uncategorized / rule-assigned transactions.
 * Never for money transfers: the "merchant" there is a person, and transfers to the same person
 * can be for different things.
 */
export async function assignCategory(txId: number, categoryId: number | null, opts: { applyToMerchant?: boolean } = {}) {
  const { applyToMerchant = true } = opts;
  await setTransactionCategory(txId, categoryId, 'user');

  if (categoryId !== null) {
    if (applyToMerchant) {
      const db = await getDb();
      const tx = await db.get<{ kind: string; merchant_key: string | null }>('SELECT kind, merchant_key FROM transactions WHERE id = ?', [txId]);
      if (tx?.merchant_key && tx.kind !== 'transfer') {
        await createRule('exact', tx.merchant_key, categoryId);
        await backfillRule('exact', tx.merchant_key, categoryId);
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
