import categoriesDb, { isTransferCategory } from '../db/categories';

/**
 * Categories offered as notification buttons. Money transfers only get categories of the transfer
 * type; everything else gets the most used non-transfer ones.
 */
export async function buildCategorySuggestions(kind: string, limit: number) {
  const all = await categoriesDb.topCategories(10_000);
  const wantTransfer = kind === 'transfer';
  // "Пополнение счёта" is for deposits only
  return all.filter((c) => isTransferCategory(c) === wantTransfer && c.system !== 'topup').slice(0, limit);
}

export default { buildCategorySuggestions };
