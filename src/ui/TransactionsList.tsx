import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HeaderBackButton } from '@react-navigation/elements';
import {
  categoriesWithTransactions, CategoryFilter, CategoryWithCount, isUnread, kindsWithTransactions, TxFilter, listTransactionsFiltered, listTransactionsPage,
  markTransactionsSeen, merchantsWithTransactions, MerchantWithCount, PageCursor, searchTransactions, TransactionRow,
} from '../db/transactions';
import { emitTransactionsChanged, onTransactionsChanged } from '../events';
import { Category, categoryLabel, countPastTransactionsOfCategory, deleteCategory, getCategory, moveTransactionsOutOfCategory } from '../db/categories';
import { currentYm, monthStart, spendingEntries } from '../db/plans';
import { useDisplayCurrency } from '../displayCurrency';
import { assignCategoryToMany } from '../assign';
import { navigationRef, TabParamList, useRootNavigation } from '../navigation';
import Button from './Button';
import CategoryPickerModal from './CategoryPickerModal';
import Checkbox from './Checkbox';
import Chip from './Chip';
import { openAddTransaction, openTransaction } from './modals';
import Fab from './Fab';
import PushAccessBanner from './PushAccessBanner';
import CardBalance from './CardBalance';
import SettingsButton from './SettingsButton';
import { dayKey, formatDay, KIND_LABELS, plural } from './format';
import { formatWithCurrency } from './money';
import { formStyles } from './formStyles';
import { ChevronRightIcon, PencilIcon, SearchIcon } from './icons';
import { DayRange, formatRange, rangeToUnix } from './RangeCalendar';
import { ActiveFilter, AllFiltersSheet, DateSheet, FilterButton, OptionsSheet } from './FilterSheets';
import { colors } from './theme';
import { confirmDeleteTransaction } from './transactionActions';
import TransactionItem from './TransactionItem';
import { toast, toastError } from './toast';
import { showLimitAlert } from '../notifications/notifeeIntegration';

/** The newest operations shown first; more come in pages while scrolling. */
const FIRST_PAGE = 10;
const PAGE_SIZE = 20;

type Filter = { query: string; categories: CategoryFilter[]; merchants: string[]; kinds: string[]; range: DayRange | null };

/** Every filter set applies at once: text, categories (any of), merchants (any of), kinds (any of) and dates combine. */
function isFilterActive(f: Filter): boolean {
  return f.query.trim() !== '' || f.categories.length > 0 || f.merchants.length > 0 || f.kinds.length > 0 || f.range !== null;
}

async function runFilterQuery(f: Filter): Promise<TransactionRow[] | null> {
  if (!isFilterActive(f)) return null;
  const r = f.range ? rangeToUnix(f.range) : undefined;
  const tx: TxFilter = { categories: f.categories, merchants: f.merchants, kinds: f.kinds, from: r?.from, to: r?.to };
  return f.query.trim() ? searchTransactions(f.query, tx) : listTransactionsFiltered(tx);
}


const SEARCH_DEBOUNCE_MS = 200;

export default function TransactionsList() {
  const navigation = useRootNavigation();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Drops results of requests superseded by a newer reload
  const requestId = useRef(0);
  const loadedCount = useRef(0);

  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<CategoryFilter[]>([]);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [kindOptions, setKindOptions] = useState<Array<{ kind: string; count: number }>>([]);
  // which picker sheet is open
  const [sheet, setSheet] = useState<'category' | 'kind' | 'date' | 'all' | null>(null);
  const [range, setRange] = useState<DayRange | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryWithCount[]>([]);
  const [merchantOptions, setMerchantOptions] = useState<MerchantWithCount[]>([]);
  const filter: Filter = { query, categories, merchants, kinds, range };
  // read by refreshAll without making it change (and re-run focus effects) on every keystroke
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const [results, setResults] = useState<TransactionRow[] | null>(null); // null = no filter, normal feed
  // how many of the filtered results are shown (lazy, like the feed)
  const [shownResults, setShownResults] = useState(FIRST_PAGE);
  const searchId = useRef(0);

  // opened from the stats screen: filter by that category
  const route = useRoute<RouteProp<TabParamList, 'Transactions'>>();
  const { category: incomingCategory, query: incomingQuery, range: incomingRange, kinds: incomingKinds, nonce, from } = route.params ?? {};
  // the other filters are cleared: only what was asked for is shown
  useEffect(() => {
    if (incomingCategory === undefined) return;
    setQuery(''); setMerchants([]);
    setCategories([incomingCategory]); setRange(incomingRange ?? null); setKinds(incomingKinds ?? []);
  }, [incomingCategory, nonce]);
  // opened from a merchant's card: its name in the search field, as if typed
  useEffect(() => {
    if (incomingQuery === undefined) return;
    setCategories([]); setMerchants([]); setRange(null); setKinds([]);
    setQuery(incomingQuery);
  }, [incomingQuery, nonce]);

  // edit mode: 🗑 on every row. selectMode (a long press on a row) puts checkboxes in front; a tap opens a row
  const [editMode, setEditMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  // Re-reads everything currently on screen (at least one page), so returning
  // from a detail screen keeps the scroll depth instead of snapping back to 50 rows.
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    const page = await listTransactionsPage(null, Math.max(FIRST_PAGE, loadedCount.current));
    if (id !== requestId.current) return;
    loadedCount.current = page.rows.length;
    setRows(page.rows);
    setCursor(page.nextCursor);
    setLoading(false);
  }, []);

  const runFilter = useCallback(async (f: Filter) => {
    const id = ++searchId.current;
    const found = await runFilterQuery(f);
    if (id === searchId.current) setResults(found);
  }, []);

  const loadCategoryOptions = useCallback(() => {
    categoriesWithTransactions().then(setCategoryOptions).catch((e) => console.error('load category filter failed', e));
    merchantsWithTransactions().then(setMerchantOptions).catch((e) => console.error('load merchant filter failed', e));
    kindsWithTransactions().then(setKindOptions).catch((e) => console.error('load kind filter failed', e));
  }, []);

  const loadMore = useCallback(async () => {
    // filtered: the results are all loaded, only shown a page at a time
    if (results) { setShownResults((n) => (n < results.length ? n + PAGE_SIZE : n)); return; }
    if (!cursor || loadingMore || loading) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const page = await listTransactionsPage(cursor, PAGE_SIZE);
      if (id !== requestId.current) return;
      setRows((prev) => {
        const next = prev.concat(page.rows);
        loadedCount.current = next.length;
        return next;
      });
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, loading, results]);

  const refreshAll = useCallback(() => {
    reload().catch((e) => console.error('reload transactions failed', e));
    runFilter(filterRef.current).catch((e) => console.error('filter failed', e));
    loadCategoryOptions();
  }, [reload, runFilter, loadCategoryOptions]);

  useFocusEffect(refreshAll);
  useEffect(() => onTransactionsChanged(refreshAll), [refreshAll]);

  // text: debounced while typing; categories / merchants / dates: immediately
  useEffect(() => {
    const t = setTimeout(() => { runFilter(filterRef.current).catch((e) => console.error('filter failed', e)); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, runFilter]);
  useEffect(() => {
    runFilter(filterRef.current).catch((e) => console.error('filter failed', e));
  }, [categories, merchants, kinds, range, runFilter]);
  // a new filter starts from its first page; a refresh (back from an operation) keeps how far it was scrolled
  useEffect(() => { setShownResults(FIRST_PAGE); }, [query, categories, merchants, kinds, range]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadedCount.current = 0; // pull-to-refresh goes back to the first page
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  // memoized: sections, the selection pruning and the day totals (a DB query) depend on it, so a new array each render
  // re-ran them on every keystroke while a filter was on
  const data = useMemo(() => (results ? results.slice(0, shownResults) : rows), [results, shownResults, rows]);
  const listKey = JSON.stringify([query.trim(), categories, merchants, kinds, range]);

  // the filters set, as chips to clear one by one
  const activeFilters: ActiveFilter[] = [];
  for (const cat of categories) {
    const c = categoryOptions.find((o) => o.category === cat);
    activeFilters.push({ key: `c${cat}`, label: c ? `${c.emoji || ''} ${c.name}`.trim() : cat === 'none' ? 'Без категории' : 'Категория', clear: () => setCategories((p) => p.filter((x) => x !== cat)) });
  }
  for (const k of kinds) {
    activeFilters.push({ key: `k${k}`, label: KIND_LABELS[k] ?? k, clear: () => setKinds((p) => p.filter((x) => x !== k)) });
  }
  for (const mer of merchants) {
    const m = merchantOptions.find((o) => o.merchant === mer);
    activeFilters.push({ key: `m${mer}`, label: m?.name ?? 'Мерчант', clear: () => setMerchants((p) => p.filter((x) => x !== mer)) });
  }
  if (range) activeFilters.push({ key: 'date', label: formatRange(range), clear: () => setRange(null) });
  if (query.trim()) activeFilters.push({ key: 'text', label: `«${query.trim()}»`, clear: () => setQuery('') });
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // "Прочитать (N)": the unread ones among the selected
  const unreadSelected = useMemo(() => data.filter((r) => selected.has(r.id) && isUnread(r)).map((r) => r.id), [data, selected]);
  const readSelected = () => {
    markTransactionsSeen(unreadSelected).then(() => emitTransactionsChanged()).catch((e) => console.error('mark seen failed', e));
  };

  // forget selected transactions that are no longer shown (deleted, filtered out)
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(data.map((r) => r.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  const sections = useMemo(() => {
    const out: Array<{ key: string; title: string; dayStart: number; data: TransactionRow[] }> = [];
    for (const r of data) {
      const key = dayKey(r.occurred_at);
      if (out.length === 0 || out[out.length - 1].key !== key) {
        const d = new Date(r.occurred_at * 1000);
        out.push({ key, title: formatDay(r.occurred_at), dayStart: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000, data: [] });
      }
      out[out.length - 1].data.push(r);
    }
    return out;
  }, [data]);

  // spent per day for the day headers: all of the day's transactions, not only the ones loaded or filtered,
  // converted to the app's currency (Настройки → Валюта); transactions themselves stay in their own currency
  const currency = useDisplayCurrency();
  const [daySpent, setDaySpent] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (sections.length === 0) { setDaySpent(new Map()); return; }
    const from = sections[sections.length - 1].dayStart;
    const last = new Date(sections[0].dayStart * 1000);
    const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).getTime() / 1000;
    let stale = false;
    spendingEntries(from, to, currency).then((rows) => {
      if (stale) return;
      const m = new Map<string, number>();
      for (const r of rows) m.set(dayKey(r.occurred_at), (m.get(dayKey(r.occurred_at)) ?? 0) + r.spent_minor);
      setDaySpent(m);
    }).catch((e) => console.error('day totals failed', e));
    return () => { stale = true; };
  }, [sections, currency]);

  // a long press on a row starts selecting several, with that row selected
  function startSelect(id: number) {
    setSelectMode(true);
    setSelected(new Set([id]));
  }

  function endSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  // "Готово" leaves edit mode together with any selection
  function toggleEditMode() {
    setEditMode((on) => !on);
    setSelectMode(false);
    setSelected(new Set());
  }

  // everything currently in the list (filtered results, or the loaded part of the feed)
  const allSelected = selectMode && data.length > 0 && data.every((r) => selected.has(r.id));
  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelectMode(true);
      setSelected(new Set(data.map((r) => r.id)));
    }
  }

  // "Редактировать" lives in the tab header, next to the title
  const tabNavigation = useNavigation<BottomTabNavigationProp<TabParamList, 'Transactions'>>();

  function resetFilters() {
    setQuery('');
    setCategories([]);
    setMerchants([]);
    setKinds([]);
    setRange(null);
  }

  // came here from another screen (not the tab bar): back returns there with the filter cleared
  function goBack() {
    const target = from;
    tabNavigation.setParams({ from: undefined, category: undefined, query: undefined, range: undefined, kinds: undefined });
    resetFilters();
    if (target === 'Merchants' || target === 'Categories') navigation.navigate(target);
    else if (target) tabNavigation.navigate(target);
  }

  // Android hardware back does the same as the header arrow
  useFocusEffect(useCallback(() => {
    if (!from) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => sub.remove();
  }, [from]));

  // opening the tab from the tab bar is a normal visit: no back button
  useEffect(() => tabNavigation.addListener('tabPress', () => {
    if (from) tabNavigation.setParams({ from: undefined });
  }), [tabNavigation, from]);

  // leaving the tab ends edit mode together with any selection
  // Leaving for another tab starts the next visit clean: no filters, search or edit mode. A screen pushed over
  // the tabs (merchants, categories) keeps them, to come back to the same list.
  useEffect(() => tabNavigation.addListener('blur', () => {
    const routes = navigationRef.getRootState()?.routes;
    if (routes && routes[routes.length - 1].name !== 'Main') return;
    setEditMode(false);
    setSelectMode(false);
    setSelected(new Set());
    resetFilters();
  }), [tabNavigation]);

  useLayoutEffect(() => {
    tabNavigation.setOptions({
      headerLeft: from
        ? () => <HeaderBackButton onPress={goBack} accessibilityLabel="Назад" />
        : undefined,
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.editToggle, editMode && styles.editToggleOn]}
            onPress={toggleEditMode}
            accessibilityRole="button"
            accessibilityState={{ selected: editMode }}
          >
            <PencilIcon color={editMode ? '#FFFFFF' : colors.accent} size={13} />
            <Text style={[styles.editToggleText, editMode && styles.editToggleTextOn]}>{editMode ? 'Готово' : 'Редактировать'}</Text>
          </TouchableOpacity>
          <SettingsButton />
        </View>
      ),
    });
    // toggleEditMode / goBack only use state setters, navigation and `from`
  }, [tabNavigation, editMode, from]);

  // unselecting the last one ends the selection
  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    if (next.size === 0) setSelectMode(false);
  }

  async function applyBulk(categoryId: number | null) {
    setBulkOpen(false);
    try {
      await assignCategoryToMany([...selected], categoryId);
      showLimitAlert(categoryId);
      const n = selected.size;
      const c = categoryId === null ? undefined : await getCategory(categoryId);
      toast(`${c ? `Категория «${categoryLabel(c)}» назначена` : 'Категория убрана'}: ${n} ${plural(n, ['операция', 'операции', 'операций'])}`);
      setSelected(new Set());
      setSelectMode(false);
    } catch (e) {
      console.error('bulk assign failed', e);
      toastError('Не удалось сохранить');
    }
  }

  const selectedRows = data.filter((r) => selected.has(r.id));
  const showRowActions = editMode && !selectMode;



  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <View style={styles.list}>
      <View style={styles.header}>
        <PushAccessBanner />
        <CardBalance />
        {(
          <>
            <View style={styles.search}>
              <SearchIcon color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Поиск: мерчант, заметка, сумма…"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Очистить поиск">
                  <Text style={styles.clear}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {/* each opens its picker in a sheet; all the filters set apply together. Merchants are found by the text search
                (it matches the merchant name); a merchant card still opens the list filtered by its merchant, shown as a chip */}
            <View style={[styles.chipsWrap, styles.activeRow, styles.filterButtons]}>
              <FilterButton label="Категория" count={categories.length} active={categories.length > 0} onPress={() => setSheet('category')} />
              <FilterButton label="Тип" count={kinds.length} active={kinds.length > 0} onPress={() => setSheet('kind')} />
              <FilterButton label="Дата" active={range !== null} onPress={() => setSheet('date')} />
            </View>
            {activeFilters.length > 0 ? (
              // how many filters are set (tap: the list of them, each with ✕) and "Сбросить все"
              <View style={styles.appliedRow}>
                <TouchableOpacity onPress={() => setSheet('all')} hitSlop={8} accessibilityRole="button" accessibilityHint="Показать фильтры">
                  <Text style={styles.appliedText}>Применено фильтров: {activeFilters.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetFilters} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.resetText}>Сбросить все</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        {selectMode ? (
          // while selecting (started by a long press on a row)
          <View style={styles.toolbar}>
            <Text style={[styles.selectLabel, styles.flex]}>Выбрано: {selected.size}</Text>
            <TouchableOpacity style={styles.selectToggle} onPress={toggleSelectAll} accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }}>
              <Checkbox checked={allSelected} size={20} />
              <Text style={styles.selectLabel}>Выбрать все</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={endSelect} hitSlop={8} accessibilityRole="button">
              <Text style={styles.cancelSelect}>Отмена</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <SectionList
        // a new filter remounts the list: Android sticky headers keep their old offsets when the sections
        // change under a scrolled list and cover the rows ("Вчера" over operations)
        key={listKey}
        style={styles.list}
        sections={sections}
        keyExtractor={(i) => String(i.id)}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => {
          const spent = daySpent.get(section.key) ?? 0;
          return (
            <View style={[formStyles.sectionHeader, styles.dayHeader]}>
              <Text style={styles.dayTitle}>{section.title}</Text>
              {spent > 0 ? <Text style={styles.daySpent}>−{formatWithCurrency(spent, currency)}</Text> : null}
              <TouchableOpacity
                // the stats tab with this day picked
                onPress={() => tabNavigation.navigate('Stats', { day: section.dayStart, nonce: Date.now() })}
                hitSlop={10}
                accessibilityLabel={`Траты за день: ${section.title}`}
              >
                <ChevronRightIcon color={colors.accent} />
              </TouchableOpacity>
            </View>
          );
        }}
        renderItem={({ item }) => {
          const open = () => openTransaction(item.id);
          return (
            <TransactionItem
              tx={item}
              // a long press starts selecting (with this row); while selecting a tap toggles, otherwise opens
              onPress={selectMode ? () => toggle(item.id) : open}
              onLongPress={selectMode ? undefined : () => startSelect(item.id)}
              selectable={selectMode}
              selected={selected.has(item.id)}
              onDelete={showRowActions ? () => confirmDeleteTransaction(item) : undefined}
            />
          );
        }}
        onEndReached={() => { loadMore().catch((e) => console.error('load more failed', e)); }}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={results ? undefined : onRefresh}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : <View style={[styles.footer, (editMode || selectMode) && styles.footerTall]} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {results ? 'Ничего не найдено.' : 'Операций пока нет. Они появятся здесь после SMS или уведомления банка, или добавьте вручную ＋.'}
          </Text>
        }
      />

      {selectMode && selected.size > 0 ? (
        <View style={[styles.bottomBar, styles.bottomBarStack]}>
          {/* the unread ones among the selected */}
          {unreadSelected.length > 0 ? (
            <Button title={`Отметить просмотренными (${unreadSelected.length})`} onPress={readSelected} style={styles.secondaryButton} />
          ) : null}
          <Button title={`Изменить категорию (${selected.size})`} onPress={() => setBulkOpen(true)} />
        </View>
      ) : null}
      {/* hidden in edit mode (it would cover the ✎ / 🗑 of the last row) and while selecting (the actions bar) */}
      {editMode || selectMode ? null : <Fab onPress={openAddTransaction} accessibilityLabel="Добавить операцию" />}

      <OptionsSheet
        visible={sheet === 'category'}
        title="Категории"
        options={categoryOptions.map((c) => ({ key: c.category, label: `${categoryLabel(c)}${c.deleted ? ' (удалена)' : ''}`, count: c.count, muted: c.deleted }))}
        selected={categories}
        onToggle={(k) => setCategories((p) => toggleIn(p, k))}
        onClear={() => setCategories([])}
        onClose={() => setSheet(null)}
      />
      <OptionsSheet
        visible={sheet === 'kind'}
        title="Тип операции"
        options={kindOptions.map((o) => ({ key: o.kind, label: KIND_LABELS[o.kind] ?? o.kind, count: o.count }))}
        selected={kinds}
        onToggle={(k) => setKinds((p) => toggleIn(p, k))}
        onClear={() => setKinds([])}
        onClose={() => setSheet(null)}
      />
      <DateSheet visible={sheet === 'date'} value={range} onChange={setRange} onClose={() => setSheet(null)} />
      <AllFiltersSheet visible={sheet === 'all'} filters={activeFilters} onReset={resetFilters} onClose={() => setSheet(null)} />

      <CategoryPickerModal
        visible={bulkOpen}
        title={`Выбрано операций: ${selected.size}`}
        // a category created from here is applied to the selection right away
        transferFirst={selectedRows.length > 0 && selectedRows.every((r) => r.kind === 'transfer')}
        allowNone
        onPick={applyBulk}
        onClose={() => setBulkOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  // close under the header title
  header: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 4, backgroundColor: colors.bg },
  // chips (active filters, categories, merchants) wrap onto the next lines
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  activeRow: { marginBottom: 8 },
  // the Категория / Дата buttons, under the search field
  filterButtons: { marginTop: 10 },
  appliedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  appliedText: { fontSize: 14, color: colors.accent },
  resetText: { fontSize: 14, color: colors.danger },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderRadius: 10, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 },
  clear: { fontSize: 16, color: colors.muted },
  // wraps to a second line when "Выбрать все" is shown and everything doesn't fit
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 8 },
  selectToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  selectLabel: { fontSize: 15, color: colors.text },
  flex: { flex: 1 },
  cancelSelect: { fontSize: 15, color: colors.accent },
  editToggle: {
    // as tall as the title text
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 2,
    borderRadius: 16, borderWidth: 1, borderColor: colors.accent,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 16 },
  editToggleOn: { backgroundColor: colors.accent },
  editToggleText: { fontSize: 13, color: colors.accent },
  editToggleTextOn: { color: '#FFFFFF' },
  footer: { paddingVertical: 16, marginBottom: 72 },
  // edit mode: room for two buttons in the bottom bar
  footerTall: { marginBottom: 130 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  bottomBarStack: { gap: 8 },
  secondaryButton: { backgroundColor: colors.muted },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.muted },
  daySpent: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  deleteInfo: { paddingBottom: 10, gap: 4 },
  deleteTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  deleteHint: { fontSize: 13, color: colors.muted },
});
