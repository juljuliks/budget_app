// The latest operations of a merchant or a category, for its page: refreshed on any change.
import { useCallback, useEffect, useState } from 'react';
import { listTransactionsFiltered, TransactionRow, TxFilter } from '@/db/transactions';
import { onTransactionsChanged } from '@/domain/events';
import { toastFailure } from '@/shared/ui/toast';
import { LOAD_FAILED } from '@/shared/lib/strings';

/** How many a page shows; more — "Показать все ›". */
export const RECENT_COUNT = 5;

export function useRecentOperations(filter: TxFilter | null): TransactionRow[] {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const key = JSON.stringify(filter);
  const load = useCallback(() => {
    if (!filter) return;
    listTransactionsFiltered(filter, RECENT_COUNT).then(setRows).catch(toastFailure('load recent operations', LOAD_FAILED));
    // the filter by its value: a page passes a new object each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); return onTransactionsChanged(load); }, [load]);
  return rows;
}
