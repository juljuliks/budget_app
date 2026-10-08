import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HeaderBackButton } from '@react-navigation/elements';
import {
  categoriesWithTransactions, CategoryFilter, CategoryWithCount, GroupKind, isUnread, kindsWithTransactions, listGroupedPage, listTransactionGroups,
  listTransactionsPage, markTransactionsSeen, merchantsWithTransactions, MerchantWithCount, PageCursor, searchTransactions, transactionDayIds, transactionGroupIds,
  TransactionGroup, TransactionRow, TxFilter,
} from '../db/transactions';
import { emitTransactionsChanged, onTransactionsChanged } from '../events';
import { Category, categoryLabel, countPastTransactionsOfCategory, deleteCategory, getCategory, moveTransactionsOutOfCategory } from '../db/categories';
import { currentYm, monthStart, spendingEntries } from '../db/plans';
import { useDisplayCurrency } from '../displayCurrency';
import { assignCategoryToMany, MerchantChoice, merchantsChangePreview } from '../assign';
import { sheetAlert } from './sheetAlert';
import { navigationRef, TabParamList, useRootNavigation } from '../navigation';
import Button from './Button';
import CategoryPickerModal from './CategoryPickerModal';
import Checkbox from './Checkbox';
import Chip from './Chip';
import { openAddTransaction, openTransaction } from './modals';
import { guardLeave, setLeaveGuard } from '../leaveGuard';
import Fab from './Fab';
import PushAccessBanner from './PushAccessBanner';
import CardBalance from './CardBalance';
import SettingsButton from './SettingsButton';
import { dayKey, formatDay, KIND_LABELS, plural } from './format';
import { formatMoneyWithCurrency, formatWithCurrency } from './money';
import { formStyles } from './formStyles';
import { ChevronRightIcon, PencilIcon, SearchIcon } from './icons';
import { DayRange, formatRange, rangeToUnix } from './RangeCalendar';
import { ActiveFilter, AllFiltersSheet, DateSheet, FilterButton, OptionsSheet } from './FilterSheets';
import { colors } from './theme';
import { confirmDeleteTransaction, confirmDeleteTransactions } from './transactionActions';
import TransactionItem from './TransactionItem';
import { toast, toastError } from './toast';
import { showLimitAlert } from '../notifications/notifeeIntegration';
import { NO_CATEGORY } from './strings';
import BottomSheet from './BottomSheet';
import RadioGroup from './RadioGroup';
import { groupTitle, groupTotal } from './transactionGroups';
import { Bucket, categoryDeletePreview, currentIdsOfCategory, remainingInCategory, sortOutSummary } from '../db/categoryDeletion';
import { sortOutBanner, sortOutDoneText, sortOutLeaveText, sortOutMerchantText } from './categoryDeletionText';
import { dayKeyOf } from './dateRange';

/** Every view loads from the database a page at a time while scrolling. */
const PAGE_SIZE = 50;

type Filter = { query: string; categories: CategoryFilter[]; merchants: string[]; kinds: string[]; range: DayRange | null };

/** Every filter set applies at once: text, categories (any of), merchants (any of), kinds (any of) and dates combine. */
function isFilterActive(f: Filter): boolean {
  return f.query.trim() !== '' || f.categories.length > 0 || f.merchants.length > 0 || f.kinds.length > 0 || f.range !== null;
}

/** How the list is split into sections: by day (the feed), or another way (every operation matching the filters at once). */
type GroupBy = 'day' | GroupKind;
const GROUP_BY: Array<readonly [GroupBy, string]> = [
  ['day', 'По дням'], ['month', 'По месяцам'], ['merchant', 'По мерчантам'], ['category', 'По категориям'], ['kind', 'По типу'], ['amount', 'По сумме'],
];
// a text search: the operations it finds (matched in JS, see searchTransactions), then paged like any filter
const SEARCH_LIMIT = 5000;

/** The filters as the database applies them. */
async function resolveFilter(f: Filter): Promise<TxFilter> {
  const r = f.range ? rangeToUnix(f.range) : undefined;
  const tx: TxFilter = { categories: f.categories, merchants: f.merchants, kinds: f.kinds, from: r?.from, to: r?.to };
  if (f.query.trim()) tx.ids = (await searchTransactions(f.query, tx, SEARCH_LIMIT)).map((row) => row.id);
  return tx;
}

type Row = TransactionRow & { group_key?: string };
type ListView = { filter: TxFilter; groupBy: GroupBy };
/** Where the next page starts: a keyset cursor by day (new operations don't shift it), an offset in the groups' order. */
type Next = PageCursor | number | null;

async function fetchPage(v: ListView, from: Next, limit: number): Promise<{ rows: Row[]; next: Next }> {
  if (v.groupBy === 'day') {
    const p = await listTransactionsPage(typeof from === 'number' ? null : from, limit, v.filter);
    return { rows: p.rows, next: p.nextCursor };
  }
  const offset = typeof from === 'number' ? from : 0;
  const rows = await listGroupedPage(v.filter, v.groupBy, offset, limit);
  return { rows, next: rows.length === limit ? offset + rows.length : null };
}

const SEARCH_DEBOUNCE_MS = 200;

export default function TransactionsList() {
  const navigation = useRootNavigation();
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

  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<CategoryFilter[]>([]);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [kindOptions, setKindOptions] = useState<Array<{ kind: string; count: number }>>([]);
  // which picker sheet is open
  const [sheet, setSheet] = useState<'category' | 'kind' | 'date' | 'all' | 'group' | null>(null);
  // a view, not a filter: kept by "Сбросить все", back to by day when leaving the tab
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const groupByRef = useRef(groupBy);
  groupByRef.current = groupBy;
  const [range, setRange] = useState<DayRange | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryWithCount[]>([]);
  const [merchantOptions, setMerchantOptions] = useState<MerchantWithCount[]>([]);
  const filter: Filter = { query, categories, merchants, kinds, range };
  // read by refreshAll without making it change (and re-run focus effects) on every keystroke
  const filterRef = useRef(filter);
  filterRef.current = filter;

  // opened from the stats screen: filter by that category
  const route = useRoute<RouteProp<TabParamList, 'Transactions'>>();
  const { category: incomingCategory, query: incomingQuery, range: incomingRange, kinds: incomingKinds, sortOut: incomingSortOut, nonce, from } = route.params ?? {};
  // the other filters are cleared: only what was asked for is shown
  useEffect(() => {
    if (incomingCategory === undefined) return;
    dropSortOut(); // another way in ends a sort-out left going on
    setQuery(''); setMerchants([]);
    setCategories([incomingCategory]); setRange(incomingRange ?? null); setKinds(incomingKinds ?? []);
  }, [incomingCategory, nonce]);
  // opened from a merchant's card: its name in the search field, as if typed
  useEffect(() => {
    if (incomingQuery === undefined) return;
    dropSortOut(); // another way in ends a sort-out left going on
    setCategories([]); setMerchants([]); setRange(null); setKinds([]);
    setQuery(incomingQuery);
  }, [incomingQuery, nonce]);

  // edit mode: 🗑 on every row. selectMode (a long press on a row) puts checkboxes in front; a tap opens a row
  const [editMode, setEditMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  // sorting out a category being deleted (from its delete sheet): locked to it and this month, grouped by merchant,
  // always selecting; when nothing of this month is left in it, where everything went and the delete
  type SortOut = { id: number; label: string; ids: number[]; month: DayRange; before: GroupBy };
  const [sortOut, setSortOut] = useState<SortOut | null>(null);
  const sortOutRef = useRef(sortOut);
  sortOutRef.current = sortOut;
  const [remaining, setRemaining] = useState<Bucket | null>(null);
  const doneShown = useRef(false);
  const selecting = selectMode || sortOut !== null;
  const refreshRemaining = useCallback(() => {
    const so = sortOutRef.current;
    if (!so) { setRemaining(null); return; }
    remainingInCategory(so.id)
      .then((b) => { if (sortOutRef.current?.id === so.id) setRemaining(b); })
      .catch((e) => console.error('remaining failed', e));
  }, []);
  useEffect(() => {
    if (incomingSortOut === undefined) return undefined;
    let live = true;
    (async () => {
      const [c, ids] = await Promise.all([getCategory(incomingSortOut), currentIdsOfCategory(incomingSortOut)]);
      if (!live || !c) return;
      const now = new Date();
      const month: DayRange = { from: dayKeyOf(new Date(now.getFullYear(), now.getMonth(), 1)), to: dayKeyOf(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
      doneShown.current = false;
      setRemaining(null);
      setSortOut({ id: c.id, label: categoryLabel(c), ids, month, before: groupByRef.current });
      setQuery(''); setMerchants([]); setKinds([]);
      setCategories([c.id]); setRange(month); setGroupBy('merchant');
    })().catch((e) => console.error('start sort-out failed', e));
    return () => { live = false; };
  }, [incomingSortOut, nonce]);
  useEffect(refreshRemaining, [sortOut, refreshRemaining]);
  // nothing left: where they went, and the delete
  useEffect(() => {
    if (!sortOut || !remaining || remaining.n > 0 || doneShown.current) return;
    doneShown.current = true;
    (async () => {
      const [summary, p] = await Promise.all([sortOutSummary(sortOut.id, sortOut.ids), categoryDeletePreview(sortOut.id)]);
      const t = sortOutDoneText(sortOut.label, summary, p);
      sheetAlert(t.title, t.message, [
        { text: 'Не удалять', style: 'cancel', onPress: () => leaveSortOut() },
        {
          text: `Удалить «${sortOut.label}»`, style: 'destructive', onPress: () => {
            deleteCategory(sortOut.id, null).then(() => {
              emitTransactionsChanged();
              toast(`Категория «${sortOut.label}» удалена`);
              leaveSortOut();
            }).catch((e) => { console.error('delete category failed', e); toastError('Не удалось удалить'); });
          },
        },
      ]);
    })().catch((e) => console.error('sort-out summary failed', e));
  }, [sortOut, remaining]);
  // Reads the first page of the current filters and grouping; `keepDepth` (back from an operation, a change elsewhere)
  // re-reads as many as were loaded, so the list keeps its scroll depth instead of snapping back to one page
  const movedOut = useRef(false);
  const [remount, setRemount] = useState(0);
  const reload = useCallback(async (keepDepth: boolean) => {
    const id = ++requestId.current;
    const groupBy = groupByRef.current;
    const filter = await resolveFilter(filterRef.current);
    const view: ListView = { filter, groupBy };
    const limit = keepDepth ? Math.max(PAGE_SIZE, loadedCount.current) : PAGE_SIZE;
    const [page, found] = await Promise.all([fetchPage(view, null, limit), groupBy === 'day' ? null : listTransactionGroups(filter, groupBy)]);
    if (id !== requestId.current) return;
    viewRef.current = view;
    // operations moved out of the list (a category given to them under a category filter): a list scrolled down
    // keeps an offset past its new end on Android — rows slide under the sticky headers and taps don't reach them
    // until a scroll. Drawn anew from the top instead
    if (movedOut.current && page.rows.length < loadedCount.current) setRemount((n) => n + 1);
    movedOut.current = false;
    loadedCount.current = page.rows.length;
    setLoaded({ rows: page.rows, groups: found });
    setNext(page.next);
    setGroupIds(new Map());
    setLoading(false);
  }, []);

  const loadCategoryOptions = useCallback(() => {
    categoriesWithTransactions().then(setCategoryOptions).catch((e) => console.error('load category filter failed', e));
    merchantsWithTransactions().then(setMerchantOptions).catch((e) => console.error('load merchant filter failed', e));
    kindsWithTransactions().then(setKindOptions).catch((e) => console.error('load kind filter failed', e));
  }, []);

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

  const refreshAll = useCallback(() => {
    reload(true).catch((e) => console.error('reload transactions failed', e));
    loadCategoryOptions();
    refreshRemaining();
  }, [reload, loadCategoryOptions, refreshRemaining]);

  useFocusEffect(refreshAll);
  useEffect(() => onTransactionsChanged(refreshAll), [refreshAll]);

  // a new filter or grouping starts from its first page with nothing selected; text: debounced while typing
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return undefined; }
    setSelectMode(false);
    setSelected(new Set());
    const t = setTimeout(() => { reload(false).catch((e) => console.error('filter failed', e)); }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [query, categories, merchants, kinds, range, groupBy, reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadedCount.current = 0; // pull-to-refresh goes back to the first page
    try { await reload(true); } finally { setRefreshing(false); }
  }, [reload]);

  const data = rows;
  const listKey = JSON.stringify([query.trim(), categories, merchants, kinds, range, groupBy, remount]);

  // the filters set, as chips to clear one by one
  const activeFilters: ActiveFilter[] = [];
  for (const cat of sortOut ? [] : categories) {
    const c = categoryOptions.find((o) => o.category === cat);
    activeFilters.push({ key: `c${cat}`, label: c ? `${c.emoji || ''} ${c.name}`.trim() : cat === 'none' ? NO_CATEGORY : 'Категория', clear: () => setCategories((p) => p.filter((x) => x !== cat)) });
  }
  for (const k of kinds) {
    activeFilters.push({ key: `k${k}`, label: KIND_LABELS[k] ?? k, clear: () => setKinds((p) => p.filter((x) => x !== k)) });
  }
  for (const mer of merchants) {
    const m = merchantOptions.find((o) => o.merchant === mer);
    activeFilters.push({ key: `m${mer}`, label: m?.name ?? 'Мерчант', clear: () => setMerchants((p) => p.filter((x) => x !== mer)) });
  }
  if (range && !(sortOut && range.from === sortOut.month.from && range.to === sortOut.month.to)) {
    activeFilters.push({ key: 'date', label: formatRange(range), clear: () => changeRange(null) });
  }
  if (query.trim()) activeFilters.push({ key: 'text', label: `«${query.trim()}»`, clear: () => setQuery('') });
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // "Прочитать (N)": the unread ones among the selected
  const unreadSelected = useMemo(() => data.filter((r) => selected.has(r.id) && isUnread(r)).map((r) => r.id), [data, selected]);
  const readSelected = () => {
    markTransactionsSeen(unreadSelected).then(() => emitTransactionsChanged()).catch((e) => console.error('mark seen failed', e));
  };

  type Section = { key: string; title: string; dayStart: number; data: Row[]; group?: TransactionGroup };
  const sections = useMemo(() => {
    const out: Section[] = [];
    if (groups) {
      // the groups as far as the rows loaded reach
      const byKey = new Map(groups.map((g) => [g.key, g]));
      const by = viewRef.current.groupBy as GroupKind;
      for (const r of data) {
        const key = r.group_key ?? '';
        if (out.length === 0 || out[out.length - 1].key !== key) {
          const g = byKey.get(key);
          out.push({ key, title: g ? groupTitle(g, by) : '', dayStart: 0, data: [], group: g });
        }
        out[out.length - 1].data.push(r);
      }
      return out;
    }
    for (const r of data) {
      const key = dayKey(r.occurred_at);
      if (out.length === 0 || out[out.length - 1].key !== key) {
        const d = new Date(r.occurred_at * 1000);
        out.push({ key, title: formatDay(r.occurred_at), dayStart: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000, data: [] });
      }
      out[out.length - 1].data.push(r);
    }
    return out;
  }, [data, groups]);

  // spent per day for the day headers: all of the day's transactions, not only the ones loaded or filtered,
  // converted to the app's currency (Настройки → Валюта); transactions themselves stay in their own currency
  const currency = useDisplayCurrency();
  const [daySpent, setDaySpent] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (sections.length === 0 || groups) { setDaySpent(new Map()); return; }
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
  }, [sections, groups, currency]);

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
  const allSelected = selecting && data.length > 0 && data.every((r) => selected.has(r.id));
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

  // the filters besides the locked ones of a sort-out (its category and month)
  function resetExtraFilters() {
    const so = sortOutRef.current;
    if (!so) { resetFilters(); return; }
    setQuery(''); setMerchants([]); setKinds([]); setRange(so.month);
  }

  // the dates of a sort-out: this month or a part of it
  function changeRange(next: DayRange | null) {
    const so = sortOutRef.current;
    if (!so) { setRange(next); return; }
    const m = so.month;
    const clamp = (k: string) => (k < m.from ? m.from : k > m.to ? m.to : k);
    const r2 = next ? { from: clamp(next.from), to: clamp(next.to) } : m;
    if (next && (r2.from !== next.from || r2.to !== next.to)) toast('При удалении категории — только этот месяц');
    setRange(r2);
  }

  // a sort-out ended without a word: the grouping it replaced back
  function dropSortOut() {
    const so = sortOutRef.current;
    if (!so) return;
    setSortOut(null);
    setRemaining(null);
    setGroupBy(so.before);
  }

  // a sort-out ended by leaving: the grouping it replaced back, the selection and the filters cleared
  function abortSortOut() {
    const so = sortOutRef.current;
    setSortOut(null);
    setRemaining(null);
    if (so) setGroupBy(so.before);
    setSelectMode(false);
    setSelected(new Set());
    clearParams();
  }

  // out of a sort-out by back: to where it began (the categories)
  function leaveSortOut() {
    abortSortOut();
    goBack();
  }

  // asks before leaving a sort-out; "Прервать" ends it and `proceed`s
  function askAbortSortOut(proceed: () => void) {
    const so = sortOutRef.current;
    if (!so) { proceed(); return; }
    const t = sortOutLeaveText(so.label);
    sheetAlert(t.title, t.message, [{ text: 'Продолжить', style: 'cancel' }, { text: 'Прервать', style: 'destructive', onPress: proceed }]);
  }

  function askLeaveSortOut() {
    if (!sortOutRef.current) { goBack(); return; }
    askAbortSortOut(leaveSortOut);
  }

  // any other way out during a sort-out (the tab bar, the gear, a day's stats) asks the same
  useEffect(() => (sortOut ? setLeaveGuard((proceed) => askAbortSortOut(() => { abortSortOut(); proceed(); })) : undefined), [sortOut]);

  function clearParams() {
    tabNavigation.setParams({ from: undefined, category: undefined, query: undefined, range: undefined, kinds: undefined, sortOut: undefined });
    resetFilters();
  }

  // came here from another screen (not the tab bar): back returns there with the filter cleared
  function goBack() {
    const target = from;
    clearParams();
    if (target === 'Merchants' || target === 'Categories') navigation.navigate(target);
    else if (target) tabNavigation.navigate(target);
  }

  // Android hardware back does the same as the header arrow
  useFocusEffect(useCallback(() => {
    if (!from) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { askLeaveSortOut(); return true; });
    return () => sub.remove();
  }, [from]));

  // opening the tab from the tab bar is a normal visit: no back button
  useEffect(() => tabNavigation.addListener('tabPress', () => {
    if (from) tabNavigation.setParams({ from: undefined });
  }), [tabNavigation, from]);

  // leaving the tab ends edit mode together with any selection
  // Leaving for another tab starts the next visit clean: no filters, search, grouping or edit mode. A screen pushed over
  // the tabs (merchants, categories) keeps them, to come back to the same list.
  useEffect(() => tabNavigation.addListener('blur', () => {
    const routes = navigationRef.getRootState()?.routes;
    if (routes && routes[routes.length - 1].name !== 'Main') return;
    // a sort-out stays: back on the tab, it goes on
    if (sortOutRef.current) return;
    setEditMode(false);
    setSelectMode(false);
    setSelected(new Set());
    resetFilters();
    setGroupBy('day');
  }), [tabNavigation]);

  useLayoutEffect(() => {
    tabNavigation.setOptions({
      headerLeft: from || sortOut
        ? () => <HeaderBackButton onPress={askLeaveSortOut} accessibilityLabel="Назад" />
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
  }, [tabNavigation, editMode, from, sortOut]);

  // a group's checkbox: all its operations, or none of them
  // (a day: `dayStart` given, its key is the day's)
  async function toggleGroup(key: string, dayStart?: number) {
    let ids = groupIds.get(key);
    if (!ids) {
      const v = viewRef.current;
      if (dayStart !== undefined) {
        const d = new Date(dayStart * 1000);
        ids = await transactionDayIds(v.filter, dayStart, new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() / 1000);
      } else ids = await transactionGroupIds(v.filter, v.groupBy as GroupKind, key);
      const got = ids;
      setGroupIds((m) => new Map(m).set(key, got));
    }
    const all = ids.every((id) => selected.has(id));
    const next = new Set(selected);
    for (const id of ids) if (all) next.delete(id); else next.add(id);
    setSelected(next);
    if (next.size === 0) setSelectMode(false);
  }

  // unselecting the last one ends the selection
  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    if (next.size === 0) setSelectMode(false);
  }

  async function assignBulk(categoryId: number | null, choice?: MerchantChoice) {
    try {
      movedOut.current = true;
      const merchants = await assignCategoryToMany([...selected], categoryId, choice, sortOutRef.current?.id);
      showLimitAlert(categoryId);
      const n = selected.size;
      const c = categoryId === null ? undefined : await getCategory(categoryId);
      const ops = `${n} ${plural(n, ['операция', 'операции', 'операций'])}`;
      toast(c
        ? `Категория «${categoryLabel(c)}» назначена: ${ops}${merchants ? ` и ${merchants} ${plural(merchants, ['мерчанту', 'мерчантам', 'мерчантам'])}` : ''}`
        : `Категория убрана: ${ops}`);
      setSelected(new Set());
      setSelectMode(false);
    } catch (e) {
      console.error('bulk assign failed', e);
      toastError('Не удалось сохранить');
    }
  }

  // like for one operation: if the selected ones have merchants with another category, ask whether the
  // new one is for the selected operations only or becomes those merchants' too (with what that changes)
  async function applyBulk(categoryId: number | null) {
    setBulkOpen(false);
    const change = await merchantsChangePreview([...selected], categoryId).catch((e) => { console.error('preview failed', e); return null; });
    if (!change) { await assignBulk(categoryId); return; }
    const to = await getCategory(categoryId!);
    const so = sortOutRef.current;
    if (so) {
      // sorting out: the merchants move with this month only, the past stays in the category being deleted
      const t = sortOutMerchantText(to ? categoryLabel(to) : '?', so.label, change.merchants, selected.size);
      sheetAlert(t.title, t.message, [
        { text: 'Отмена', style: 'cancel' },
        { text: t.only, onPress: () => { assignBulk(categoryId, 'only'); } },
        { text: t.also, style: 'secondary', onPress: () => { assignBulk(categoryId, 'merchant'); } },
      ]);
      return;
    }
    const names = change.merchants.length > 3 ? `${change.merchants.slice(0, 2).join(', ')} и ещё ${change.merchants.length - 2}` : change.merchants.join(', ');
    const sum = change.totals.map((t) => formatMoneyWithCurrency(t.amount_minor, t.currency)).join(' + ');
    const one = change.merchants.length === 1;
    sheetAlert(
      `Категория «${to ? categoryLabel(to) : '?'}» — только для выбранных операций или и для ${one ? 'мерчанта' : 'мерчантов'}?`,
      // nothing of theirs follows them (all picked by hand): only the new operations change
      `${one ? `Для мерчанта «${names}»` : `Для мерчантов (${names})`}: ${change.count > 0 ? `категория изменится у ${change.count} ${plural(change.count, ['операции', 'операций', 'операций'])} на ${sum}, и новые` : 'новые'} операции будут получать её автоматически. Выбранные вручную категории не изменятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: `Только для выбранных (${selected.size})`, onPress: () => { assignBulk(categoryId, 'only'); } },
        { text: one ? 'И для мерчанта' : 'И для мерчантов', style: 'secondary', onPress: () => { assignBulk(categoryId, 'merchant'); } },
      ]);
  }

  const selectedRows = data.filter((r) => selected.has(r.id));
  const showRowActions = editMode && !selecting;



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
              <FilterButton label="Категория" count={categories.length} active={categories.length > 0} disabled={!!sortOut} onPress={() => setSheet('category')} testID="filter-category" />
              <FilterButton label="Тип" count={kinds.length} active={kinds.length > 0} onPress={() => setSheet('kind')} testID="filter-kind" />
              <FilterButton label="Дата" active={range !== null} onPress={() => setSheet('date')} testID="filter-date" />
              <FilterButton label={GROUP_BY.find(([k]) => k === groupBy)![1]} active={groupBy !== 'day'} onPress={() => setSheet('group')} testID="filter-group" />
            </View>
            {sortOut ? (
              // what is left of the category being deleted
              <View style={styles.sortOutBanner} testID="sort-out-banner">
                <Text style={[styles.sortOutText, styles.flex]}>{remaining ? sortOutBanner(sortOut.label, remaining) : `Удаление «${sortOut.label}»`}</Text>
                <TouchableOpacity onPress={askLeaveSortOut} hitSlop={8} accessibilityRole="button" testID="sort-out-cancel">
                  <Text style={styles.resetText}>Отменить</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {activeFilters.length > 0 ? (
              // how many filters are set (tap: the list of them, each with ✕) and "Сбросить все"
              <View style={styles.appliedRow}>
                <TouchableOpacity onPress={() => setSheet('all')} hitSlop={8} accessibilityRole="button" accessibilityHint="Показать фильтры">
                  <Text style={styles.appliedText}>Применено фильтров: {activeFilters.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetExtraFilters} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.resetText}>Сбросить все</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        {selecting ? (
          // while selecting (started by a long press on a row; always while sorting out)
          <View style={styles.toolbar}>
            <Text style={[styles.selectLabel, styles.flex]}>Выбрано: {selected.size}</Text>
            <TouchableOpacity style={styles.selectToggle} onPress={toggleSelectAll} accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }}>
              <Checkbox checked={allSelected} size={20} />
              <Text style={styles.selectLabel}>Выбрать все</Text>
            </TouchableOpacity>
            {sortOut ? null : (
              <TouchableOpacity onPress={endSelect} hitSlop={8} accessibilityRole="button">
                <Text style={styles.cancelSelect}>Отмена</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      <SectionList
        // a new filter remounts the list: Android sticky headers keep their old offsets when the sections
        // change under a scrolled list and cover the rows ("Вчера" over operations)
        key={listKey}
        testID="operations-list"
        style={styles.list}
        sections={sections}
        keyExtractor={(i) => String(i.id)}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => {
          const g = section.group;
          if (g) {
            const ids = groupIds.get(g.key);
            const checked = !!ids && ids.every((id) => selected.has(id));
            const n = g.count;
            const total = groupTotal(g);
            return (
              <View style={[formStyles.sectionHeader, styles.dayHeader]}>
                {/* one operation: its own checkbox picks it, the header's would repeat it */}
                {selecting && n > 1 ? (
                  <TouchableOpacity testID={`group-checkbox-${section.title}`} onPress={() => { toggleGroup(g.key).catch((e) => console.error('select group failed', e)); }} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked }}>
                    <Checkbox checked={checked} size={18} />
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.dayTitle} numberOfLines={1}>{section.title} · {n} {plural(n, ['операция', 'операции', 'операций'])}</Text>
                <Text style={styles.daySpent}>{total}</Text>
              </View>
            );
          }
          const spent = daySpent.get(section.key) ?? 0;
          const dayIds = groupIds.get(section.key);
          const dayChecked = dayIds ? dayIds.every((id) => selected.has(id)) : section.data.every((r) => selected.has(r.id));
          const dayCount = dayIds?.length ?? section.data.length;
          return (
            <View style={[formStyles.sectionHeader, styles.dayHeader]}>
              {/* selecting: the day's operations at once (as a group's; one operation has its own) */}
              {selecting && dayCount > 1 ? (
                <TouchableOpacity testID={`day-checkbox-${section.key}`} onPress={() => { toggleGroup(section.key, section.dayStart).catch((e) => console.error('select day failed', e)); }} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: dayChecked }}>
                  <Checkbox checked={dayChecked} size={18} />
                </TouchableOpacity>
              ) : null}
              <Text style={styles.dayTitle}>{section.title}</Text>
              {spent > 0 ? <Text style={styles.daySpent}>−{formatWithCurrency(spent, currency)}</Text> : null}
              <TouchableOpacity
                // the stats tab with this day picked
                onPress={() => guardLeave(() => tabNavigation.navigate('Stats', { day: section.dayStart, nonce: Date.now() }))}
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
              onPress={selecting ? () => toggle(item.id) : open}
              onLongPress={selecting ? undefined : () => startSelect(item.id)}
              selectable={selecting}
              selected={selected.has(item.id)}
              onDelete={showRowActions ? () => confirmDeleteTransaction(item) : undefined}
            />
          );
        }}
        onEndReached={() => { loadMore().catch((e) => console.error('load more failed', e)); }}
        // the next page is read a screen before the end; rows are drawn a batch at a time, the ones far off-screen dropped
        onEndReachedThreshold={1}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={11}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : <View style={[styles.footer, (editMode || selecting) && styles.footerTall]} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isFilterActive(filter) ? 'Ничего не найдено.' : 'Операций пока нет. Они появятся здесь после SMS или уведомления банка, или добавьте вручную ＋.'}
          </Text>
        }
      />

      {selecting && selected.size > 0 ? (
        <View style={[styles.bottomBar, styles.bottomBarStack]}>
          {/* the unread ones among the selected */}
          {unreadSelected.length > 0 ? (
            <Button title={`Отметить просмотренными (${unreadSelected.length})`} onPress={readSelected} style={styles.secondaryButton} />
          ) : null}
          {/* as on the merchants: the category and deleting, side by side */}
          <View style={styles.bottomActions}>
            <Button title={`Категория (${selected.size})`} onPress={() => setBulkOpen(true)} style={styles.bottomButton} testID="bulk-category" />
            {/* sorting out a category being deleted: the operations get categories here, not deleted */}
            {sortOut ? null : (
              <Button title={`Удалить (${selected.size})`} danger onPress={() => confirmDeleteTransactions(selectedRows, endSelect)} style={styles.bottomButton} />
            )}
          </View>
        </View>
      ) : null}
      {/* hidden in edit mode (it would cover the ✎ / 🗑 of the last row) and while selecting (the actions bar) */}
      {editMode || selecting ? null : <Fab onPress={openAddTransaction} accessibilityLabel="Добавить операцию" />}

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
      <DateSheet visible={sheet === 'date'} value={range} onChange={changeRange} onClose={() => setSheet(null)} />
      <BottomSheet visible={sheet === 'group'} onClose={() => setSheet(null)} title="Группировать">
        <View style={styles.groupSheet}>
          <RadioGroup options={GROUP_BY} value={groupBy} onChange={(v) => { setGroupBy(v); setSheet(null); }} />
        </View>
      </BottomSheet>
      <AllFiltersSheet visible={sheet === 'all'} filters={activeFilters} onReset={resetExtraFilters} onClose={() => setSheet(null)} />

      <CategoryPickerModal
        visible={bulkOpen}
        title={`Выбрано операций: ${selected.size}`}
        // a category created from here is applied to the selection right away
        transferFirst={selectedRows.length > 0 && selectedRows.every((r) => r.kind === 'transfer')}
        deposit={selectedRows.length > 0 && selectedRows.every((r) => r.kind === 'deposit')}
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
  sortOutBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: colors.warnBg,
  },
  sortOutText: { fontSize: 14, fontWeight: '600', color: colors.warn },
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
  bottomActions: { flexDirection: 'row', gap: 10 },
  bottomButton: { flex: 1 },
  secondaryButton: { backgroundColor: colors.muted },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.muted },
  daySpent: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  groupSheet: { paddingHorizontal: 20, paddingBottom: 24 },
  deleteInfo: { paddingBottom: 10, gap: 4 },
  deleteTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  deleteHint: { fontSize: 13, color: colors.muted },
});
