import categoriesDb, { isTransferCategory } from '../db/categories';

/**
 * Categories offered as notification buttons. Money transfers only get "Перевод…" categories;
 * everything else gets the most used non-transfer ones.
 */
export async function buildCategorySuggestions(kind: string, limit: number) {
  const all = await categoriesDb.topCategories(10_000);
  const wantTransfer = kind === 'transfer';
  return all.filter((c) => isTransferCategory(c) === wantTransfer).slice(0, limit);
}

export default { buildCategorySuggestions };
