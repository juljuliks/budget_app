// When the list is read again: on focus and on any change (as deep as it was loaded), and from its first page on a new
// filter or grouping (text: debounced while typing), with nothing selected.
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { onTransactionsChanged } from '@/events';

const SEARCH_DEBOUNCE_MS = 200;

type Options = {
  reload: (keepDepth: boolean) => Promise<void>;
  /** the filters' options and the sort-out's count read along */
  alsoRefresh: Array<() => void>;
  clearSelection: () => void;
  query: string;
  /** what a new view is told by: the filters and the grouping */
  view: unknown[];
};

export function useListRefresh({ reload, alsoRefresh, clearSelection, query, view }: Options) {
  const also = useRef(alsoRefresh);
  also.current = alsoRefresh;
  const refreshAll = useCallback(() => {
    reload(true).catch((e) => console.error('reload transactions failed', e));
    for (const f of also.current) f();
  }, [reload]);
  useFocusEffect(refreshAll);
  useEffect(() => onTransactionsChanged(refreshAll), [refreshAll]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return undefined; }
    clearSelection();
    const t = setTimeout(() => { reload(false).catch((e) => console.error('filter failed', e)); }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the view's parts, listed by the caller
  }, [query, ...view, reload, clearSelection]);
}
