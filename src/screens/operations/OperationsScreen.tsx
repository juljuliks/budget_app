import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { isUnread } from '@/db/transactions';
import { useDisplayCurrency } from '@/displayCurrency';
import { CategoryPickerModal } from '@/entities/category';
import { confirmDeleteTransaction, confirmDeleteTransactions, markAllSeen } from '@/entities/transaction';
import { CardBalance } from '@/features/card-balance';
import { SortOutBanner, useSortOut } from '@/features/category-delete';
import { isFilterActive, SearchBar, useTransactionFilters } from '@/features/operations-filters';
import { PushAccessBanner } from '@/features/sms-import';
import type { DayRange } from '@/shared/lib/dateRange';
import { guardLeave } from '@/shared/navigation/leaveGuard';
import { openAddTransaction, openTransaction } from '@/shared/navigation/sheets';
import Fab from '@/shared/ui/Fab';
import { colors } from '@/shared/theme/theme';
import { GroupBy, useDaySpent } from './model/listData';
import { useBulkCategory } from './model/useBulkCategory';
import { useOperationsList } from './model/useOperationsList';
import { useListRefresh } from './model/useListRefresh';
import { useIncomingFilters, useOperationsRoute } from './model/useOperationsRoute';
import { useSelection } from './model/useSelection';
import { useTabLifecycle } from './model/useTabLifecycle';
import BulkBar from './parts/BulkBar';
import FilterSheets from './parts/FilterSheets';
import FiltersBar, { FilterSheet } from './parts/FiltersBar';
import OperationsList from './parts/OperationsList';
import SelectToolbar from './parts/SelectToolbar';
import { EMPTY, EMPTY_FILTERED, SEARCH_PLACEHOLDER } from './texts';

/**
 * The operations tab: the search and the filters, the list by day or grouped, selecting several, sorting out a
 * category being deleted (features/category-delete).
 */
export default function OperationsScreen() {
  // a view, not a filter: kept by "Сбросить все", back to by day when leaving the tab
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const groupByRef = useRef(groupBy);
  groupByRef.current = groupBy;
  const [sheet, setSheet] = useState<FilterSheet | null>(null);
  const lockRef = useRef<DayRange | null>(null);
  const filters = useTransactionFilters(lockRef);
  const { query, categories, merchants, kinds, range } = filters;
  const list = useOperationsList(filters.filterRef, groupByRef);
  const route = useOperationsRoute(filters.reset);
  const so = useSortOut<GroupBy>({
    incoming: route.params.sortOut,
    nonce: route.params.nonce,
    current: () => groupByRef.current,
    start: (id, month) => { filters.setOnly({ categories: [id], range: month }); setGroupBy('merchant'); },
    restore: setGroupBy,
    clear: () => { sel.clear(); route.clearParams(); },
    goBack: route.goBack,
  });
  const sortOut = so.sortOut;
  lockRef.current = sortOut?.month ?? null;
  const sel = useSelection(list, sortOut !== null);
  const { selected, selecting } = sel;
  useIncomingFilters(route.params, filters.setOnly, so.drop);
  const bulk = useBulkCategory({ selected, sortOut, onMovedOut: list.markMovedOut, onDone: sel.clear });
  useTabLifecycle({
    tabNavigation: route.tabNavigation, from: route.from, sortingOut: sortOut !== null, askLeave: so.askLeave,
    editMode: sel.editMode, toggleEditMode: sel.toggleEditMode,
    resetOnLeave: () => { sel.setEditMode(false); sel.clear(); filters.reset(); setGroupBy('day'); },
  });

  useListRefresh({
    reload: list.reload,
    alsoRefresh: [filters.loadOptions, so.refreshRemaining],
    clearSelection: sel.clear,
    query,
    view: [categories, merchants, kinds, range, groupBy],
  });

  const rows = list.rows;
  const active = filters.activeFilters(sortOut?.month ?? null);
  const listKey = JSON.stringify([query.trim(), categories, merchants, kinds, range, groupBy, list.remount]);
  // "Отметить просмотренными (N)": the unread ones among the selected
  const unreadSelected = useMemo(() => rows.filter((r) => selected.has(r.id) && isUnread(r)).map((r) => r.id), [rows, selected]);
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const currency = useDisplayCurrency();
  const daySpent = useDaySpent(list.sections, list.groups !== null, currency, list.viewRef.current.filter);
  const showRowActions = sel.editMode && !selecting;

  if (list.loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <View style={styles.list}>
      <View style={styles.header}>
        <PushAccessBanner />
        <CardBalance />
        <SearchBar value={query} onChange={filters.setQuery} placeholder={SEARCH_PLACEHOLDER} />
        <FiltersBar
          categories={categories.length}
          kinds={kinds.length}
          dated={range !== null}
          groupBy={groupBy}
          categoryLocked={!!sortOut}
          applied={active.length}
          onOpen={setSheet}
          onReset={filters.resetExtra}
        >
          {sortOut ? <SortOutBanner label={sortOut.label} remaining={so.remaining} onCancel={so.askLeave} /> : null}
        </FiltersBar>
        {selecting ? (
          <SelectToolbar count={selected.size} allSelected={sel.allSelected} onToggleAll={sel.toggleSelectAll} onCancel={sortOut ? undefined : sel.clear} />
        ) : null}
      </View>

      <OperationsList
        listKey={listKey}
        sections={list.sections}
        selecting={selecting}
        selected={selected}
        groupIds={list.groupIds}
        daySpent={daySpent}
        currency={currency}
        onToggleGroup={(section) => {
          (section.group ? sel.toggleGroup(section.key) : sel.toggleGroup(section.key, section.dayStart))
            .catch((e) => console.error(section.group ? 'select group failed' : 'select day failed', e));
        }}
        // the stats tab with this day picked
        onOpenDay={(dayStart) => guardLeave(() => route.tabNavigation.navigate('Stats', { day: dayStart, nonce: Date.now() }))}
        // a long press starts selecting (with this row); while selecting a tap toggles, otherwise opens
        onPressRow={(id) => (selecting ? sel.toggle(id) : openTransaction(id))}
        onLongPressRow={selecting ? undefined : sel.start}
        onDeleteRow={showRowActions ? confirmDeleteTransaction : undefined}
        loadMore={list.loadMore}
        refreshing={list.refreshing}
        onRefresh={list.onRefresh}
        loadingMore={list.loadingMore}
        tallFooter={sel.editMode || selecting}
        emptyText={isFilterActive(filters.filter) ? EMPTY_FILTERED : EMPTY}
      />

      {selecting && selected.size > 0 ? (
        <BulkBar
          count={selected.size}
          unread={unreadSelected.length}
          onRead={() => { markAllSeen(unreadSelected).catch((e) => console.error('mark seen failed', e)); }}
          onCategory={() => bulk.setOpen(true)}
          onDelete={sortOut ? undefined : () => confirmDeleteTransactions(selectedRows, sel.clear)}
        />
      ) : null}
      {/* hidden in edit mode (it would cover the ✎ / 🗑 of the last row) and while selecting (the actions bar) */}
      {sel.editMode || selecting ? null : <Fab onPress={openAddTransaction} accessibilityLabel="Добавить операцию" />}

      <FilterSheets sheet={sheet} active={active} filters={filters} groupBy={groupBy} onGroupBy={setGroupBy} onClose={() => setSheet(null)} />
      <CategoryPickerModal
        visible={bulk.open}
        title={`Выбрано операций: ${selected.size}`}
        // a category created from here is applied to the selection right away
        transferFirst={selectedRows.length > 0 && selectedRows.every((r) => r.kind === 'transfer')}
        deposit={selectedRows.length > 0 && selectedRows.every((r) => r.kind === 'deposit')}
        allowNone
        onPick={bulk.apply}
        onClose={() => bulk.setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  // close under the header title
  header: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4, backgroundColor: colors.bg },
});
