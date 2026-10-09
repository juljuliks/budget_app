// The operations' filters and how the database applies them.
import { CategoryFilter, searchTransactions, TxFilter } from '@/db/transactions';
import { DayRange, rangeToUnix } from '@/shared/lib/dateRange';

export type Filter = { query: string; categories: CategoryFilter[]; merchants: string[]; kinds: string[]; range: DayRange | null };

/** Every filter set applies at once: text, categories (any of), merchants (any of), kinds (any of) and dates combine. */
export function isFilterActive(f: Filter): boolean {
  return f.query.trim() !== '' || f.categories.length > 0 || f.merchants.length > 0 || f.kinds.length > 0 || f.range !== null;
}

// a text search: the operations it finds (matched in JS, see searchTransactions), then paged like any filter
const SEARCH_LIMIT = 5000;

/** The filters as the database applies them. */
export async function resolveFilter(f: Filter): Promise<TxFilter> {
  const r = f.range ? rangeToUnix(f.range) : undefined;
  const tx: TxFilter = { categories: f.categories, merchants: f.merchants, kinds: f.kinds, from: r?.from, to: r?.to };
  if (f.query.trim()) tx.ids = (await searchTransactions(f.query, tx, SEARCH_LIMIT)).map((row) => row.id);
  return tx;
}
