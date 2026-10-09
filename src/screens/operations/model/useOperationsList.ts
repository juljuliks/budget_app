// The list's rows: the first page of the filters and grouping, the next ones while scrolling, re-read on a change.
import { MutableRefObject, useCallback, useMemo, useRef, useState } from 'react';
import { listTransactionGroups, TransactionGroup } from '@/db/transactions';
import { Filter, resolveFilter } from '@/features/operations-filters';
import { buildSections, fetchPage, GroupBy, ListView, Next, PAGE_SIZE, Row } from './listData';

export function useOperationsList(filterRef: MutableRefObject<Filter>, groupByRef: MutableRefObject<GroupBy>) {
  // the rows loaded and (not by day) every group of what the filters match, with its count and total: one state, so
  // the rows of a new grouping are never drawn with the old one's groups (repeated headers for a frame)
  const [loaded, setLoaded] = useState<{ rows: Row[]; groups: TransactionGroup[] | null }>({ rows: [], groups: null });
  const { rows, groups } = loaded;
  const [next, setNext] = useState<Next>(null);
  // a group's checkbox: every operation of it, loaded or not (read when it's first ticked)
  const [groupIds, setGroupIds] = useState<Map<string, number[]>>(new Map());
  // what the rows loaded were read with: the next pages and a group's checkbox use the same
  const viewRef = useRef<ListView>({ filter: {}, groupBy: 'day' });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Drops results of requests superseded by a newer reload
  const requestId = useRef(0);
  const loadedCount = useRef(0);
  // operations moved out of the list (a category given to them under a category filter): a list scrolled down
  // keeps an offset past its new end on Android — rows slide under the sticky headers and taps don't reach them
  // until a scroll. Drawn anew from the top instead
  const movedOut = useRef(false);
  const [remount, setRemount] = useState(0);

  // Reads the first page of the current filters and grouping; `keepDepth` (back from an operation, a change elsewhere)
  // re-reads as many as were loaded, so the list keeps its scroll depth instead of snapping back to one page
  const reload = useCallback(async (keepDepth: boolean) => {
    const id = ++requestId.current;
    const groupBy = groupByRef.current;
    const filter = await resolveFilter(filterRef.current);
    const view: ListView = { filter, groupBy };
    const limit = keepDepth ? Math.max(PAGE_SIZE, loadedCount.current) : PAGE_SIZE;
    const [page, found] = await Promise.all([fetchPage(view, null, limit), groupBy === 'day' ? null : listTransactionGroups(filter, groupBy)]);
    if (id !== requestId.current) return;
    viewRef.current = view;
    if (movedOut.current && page.rows.length < loadedCount.current) setRemount((n) => n + 1);
    movedOut.current = false;
    loadedCount.current = page.rows.length;
    setLoaded({ rows: page.rows, groups: found });
    setNext(page.next);
    setGroupIds(new Map());
    setLoading(false);
  }, [filterRef, groupByRef]);

  const loadMore = useCallback(async () => {
    if (next === null || loadingMore || loading) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const page = await fetchPage(viewRef.current, next, PAGE_SIZE);
      if (id !== requestId.current) return;
      setLoaded((prev) => {
        // an offset page can repeat a row when operations came in meanwhile
        const have = new Set(prev.rows.map((r) => r.id));
        const all = prev.rows.concat(page.rows.filter((r) => !have.has(r.id)));
        loadedCount.current = all.length;
        return { ...prev, rows: all };
      });
      setNext(page.next);
    } finally {
      setLoadingMore(false);
    }
  }, [next, loadingMore, loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadedCount.current = 0; // pull-to-refresh goes back to the first page
    try { await reload(true); } finally { setRefreshing(false); }
  }, [reload]);

  const sections = useMemo(() => buildSections(rows, groups, viewRef.current.groupBy), [rows, groups]);
  const markMovedOut = () => { movedOut.current = true; };

  return { rows, groups, sections, viewRef, groupIds, setGroupIds, loading, loadingMore, refreshing, remount, reload, loadMore, onRefresh, markMovedOut };
}
