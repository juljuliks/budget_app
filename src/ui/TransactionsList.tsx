import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HeaderBackButton } from '@react-navigation/elements';
import {
  categoriesWithTransactions, CategoryFilter, CategoryWithCount, isUnread, TxFilter, listTransactionsFiltered, listTransactionsPage,
  markTransactionsSeen, merchantsWithTransactions, MerchantWithCount, normalizeForSearch, PageCursor, searchTransactions, TransactionRow,
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
import Fab from './Fab';
import PushAccessBanner from './PushAccessBanner';
import CardBalance from './CardBalance';
import SettingsButton from './SettingsButton';
import { dayKey, formatDay, plural } from './format';
import { formatWithCurrency } from './money';
import { formStyles } from './formStyles';
import { ChevronRightIcon, PencilIcon, SearchIcon } from './icons';
import RangeCalendar, { DayRange, formatRange, rangeToUnix } from './RangeCalendar';
import Segmented from './Segmented';
import { colors } from './theme';
import { confirmDeleteTransaction } from './transactionActions';
import TransactionItem from './TransactionItem';

const PAGE_SIZE = 50;

type FilterMode = 'text' | 'category' | 'merchant' | 'date';
const MODES = [['text', 'Текст'], ['category', 'Категория'], ['merchant', 'Мерчант'], ['date', 'Дата']] as const;
type Filter = {
  query: string; category: CategoryFilter | null; merchant: string | null; range: DayRange | null;
  /** deleting a category: only its transactions from this month on */
  from?: number;
};

/** Every filter set applies at once: text, category, merchant and dates combine. The mode only picks which one is edited. */
function isFilterActive(f: Filter): boolean {
  return f.query.trim() !== '' || f.category !== null || f.merchant !== null || f.range !== null;
}

async function runFilterQuery(f: Filter): Promise<TransactionRow[] | null> {
  if (!isFilterActive(f)) return null;
  const r = f.range ? rangeToUnix(f.range) : undefined;
  const from = r && f.from !== undefined ? Math.max(r.from, f.from) : r?.from ?? f.from;
  const tx: TxFilter = { category: f.category ?? undefined, merchant: f.merchant ?? undefined, from, to: r?.to };
  return f.query.trim() ? searchTransactions(f.query, tx) : listTransactionsFiltered(tx);
}

/** Deleting a category: every mode but "Категория" and every other category are off. */
const DELETE_MODE_DISABLED: FilterMode[] = ['text', 'merchant', 'date'];

const SEARCH_DEBOUNCE_MS = 200;

type Props = {
  /**
   * The list reused to delete a category (CategoryDelete): its transactions of this month, already in
   * multi-select, are moved to other categories; the category can be deleted once none are left.
   */
  deleteCategoryId?: number;
};

export default function TransactionsList({ deleteCategoryId }: Props = {}) {
  const deleting = deleteCategoryId !== undefined;
  const navigation = useRootNavigation();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Drops results of requests superseded by a newer reload
  const requestId = useRef(0);
  const loadedCount = useRef(0);

  const [mode, setMode] = useState<FilterMode>(deleting ? 'category' : 'text');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter | null>(deleting ? deleteCategoryId! : null);
  const [merchant, setMerchant] = useState<string | null>(null);
  const [merchantQuery, setMerchantQuery] = useState('');
  const [range, setRange] = useState<DayRange | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<CategoryWithCount[]>([]);
  const [merchantOptions, setMerchantOptions] = useState<MerchantWithCount[]>([]);
  const filter: Filter = { query, category, merchant, range, from: deleting ? monthStart(currentYm()) : undefined };
  // read by refreshAll without making it change (and re-run focus effects) on every keystroke
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const [results, setResults] = useState<TransactionRow[] | null>(null); // null = no filter, normal feed
  const searchId = useRef(0);

  // opened from the stats screen: filter by that category
  const route = useRoute<RouteProp<TabParamList, 'Transactions'>>();
  const { category: incomingCategory, merchant: incomingMerchant, range: incomingRange, nonce, from } = route.params ?? {};
  // the other filters are cleared: only what was asked for is shown
  useEffect(() => {
    if (incomingCategory === undefined) return;
    setQuery(''); setMerchant(null);
    setMode('category'); setCategory(incomingCategory); setRange(incomingRange ?? null);
  }, [incomingCategory, nonce]);
  // opened from a merchant's card: filter by that merchant
  useEffect(() => {
    if (incomingMerchant === undefined) return;
    setQuery(''); setCategory(null); setRange(null);
    setMode('merchant'); setMerchant(incomingMerchant);
  }, [incomingMerchant, nonce]);

  // edit mode: ✎ / 🗑 on every row and the selection toolbar; selectMode (inside edit mode) replaces the icons with checkboxes
  const [editMode, setEditMode] = useState(deleting);
  const [selectMode, setSelectMode] = useState(deleting);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  // Re-reads everything currently on screen (at least one page), so returning
  // from a detail screen keeps the scroll depth instead of snapping back to 50 rows.
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    const page = await listTransactionsPage(null, Math.max(PAGE_SIZE, loadedCount.current));
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
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || loading || results) return;
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

  // text: debounced while typing; category / date / mode switch: immediately
  useEffect(() => {
    const t = setTimeout(() => { runFilter(filterRef.current).catch((e) => console.error('filter failed', e)); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, runFilter]);
  useEffect(() => {
    runFilter(filterRef.current).catch((e) => console.error('filter failed', e));
  }, [category, merchant, range, runFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadedCount.current = 0; // pull-to-refresh goes back to the first page
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  const data = results ?? rows;

  // the filters set, as chips to clear one by one
  const activeFilters: Array<{ key: FilterMode; label: string; clear: () => void }> = [];
  if (query.trim()) activeFilters.push({ key: 'text', label: `«${query.trim()}»`, clear: () => setQuery('') });
  if (category !== null) {
    const c = categoryOptions.find((o) => o.category === category);
    activeFilters.push({ key: 'category', label: c ? categoryLabel(c) : category === 'none' ? 'Без категории' : 'Категория', clear: () => setCategory(null) });
  }
  if (merchant !== null) {
    const m = merchantOptions.find((o) => o.merchant === merchant);
    activeFilters.push({ key: 'merchant', label: m?.name ?? 'Мерчант', clear: () => setMerchant(null) });
  }
  if (range) activeFilters.push({ key: 'date', label: formatRange(range), clear: () => setRange(null) });
  const modeOptions = MODES.map(([k, label]) => [k, activeFilters.some((f) => f.key === k) ? `${label} •` : label] as const);

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

  // selection lives inside edit mode
  function toggleSelectMode() {
    setSelectMode((on) => !on);
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
    setMode('text');
    setQuery('');
    setCategory(null);
    setMerchant(null);
    setMerchantQuery('');
    setRange(null);
  }

  // came here from another screen (not the tab bar): back returns there with the filter cleared
  function goBack() {
    const target = from;
    tabNavigation.setParams({ from: undefined, category: undefined, merchant: undefined, range: undefined });
    resetFilters();
    if (target) tabNavigation.navigate(target);
  }

  // Android hardware back does the same as the header arrow
  useFocusEffect(useCallback(() => {
    if (!from) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => sub.remove();
  }, [from]));

  // opening the tab from the tab bar is a normal visit: no back button
  useEffect(() => (deleting ? undefined : tabNavigation.addListener('tabPress', () => {
    if (from) tabNavigation.setParams({ from: undefined });
  })), [tabNavigation, from, deleting]);

  // leaving the tab ends edit mode together with any selection
  // Leaving for another tab starts the next visit clean: no filters, search or edit mode. Opening a
  // transaction from here (a screen pushed over the tabs) keeps them, to come back to the same list.
  useEffect(() => (deleting ? undefined : tabNavigation.addListener('blur', () => {
    const routes = navigationRef.getRootState()?.routes;
    if (routes && routes[routes.length - 1].name !== 'Main') return;
    setEditMode(false);
    setSelectMode(false);
    setSelected(new Set());
    resetFilters();
  })), [tabNavigation, deleting]);

  useLayoutEffect(() => {
    if (deleting) return; // the delete screen keeps its own header
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
  }, [tabNavigation, editMode, from, deleting]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function applyBulk(categoryId: number | null) {
    setBulkOpen(false);
    try {
      if (deleting) {
        // moved ones leave the list (they are no longer in the category being deleted)
        await moveTransactionsOutOfCategory([...selected], deleteCategoryId!, categoryId);
        emitTransactionsChanged();
        setSelected(new Set());
        return;
      }
      await assignCategoryToMany([...selected], categoryId);
      setSelected(new Set());
      setSelectMode(false);
    } catch (e) {
      console.error('bulk assign failed', e);
    }
  }

  const selectedRows = data.filter((r) => selected.has(r.id));
  const showRowActions = editMode && !selectMode;

  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [pastCount, setPastCount] = useState(0);
  useEffect(() => {
    if (!deleting) return;
    Promise.all([getCategory(deleteCategoryId!), countPastTransactionsOfCategory(deleteCategoryId!)])
      .then(([c, n]) => { setDeletingCategory(c ?? null); setPastCount(n); })
      .catch((e) => console.error('load category failed', e));
  }, [deleting, deleteCategoryId]);

  async function removeCategory() {
    try {
      await deleteCategory(deleteCategoryId!, null);
      emitTransactionsChanged();
      navigation.goBack();
    } catch (e) {
      console.error('delete category failed', e);
    }
  }

  const merchantWords = normalizeForSearch(merchantQuery);
  const shownMerchants = merchantWords
    ? merchantOptions.filter((m) => normalizeForSearch(m.name).includes(merchantWords))
    : merchantOptions;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <View style={styles.list}>
      <View style={styles.header}>
        {deleting ? (
          <View style={styles.deleteInfo}>
            <Text style={styles.deleteTitle}>Удалить «{deletingCategory ? categoryLabel(deletingCategory) : '…'}»</Text>
            <Text style={styles.deleteHint}>
              {data.length > 0
                ? 'Удалить можно только пустую категорию. Выберите операции этого месяца и перенесите их в другие категории — перенесённые пропадут из списка. Мерчанты этих операций тоже получат новую категорию.'
                : 'В этом месяце операций в категории нет — её можно удалить. Вместе с ней удалятся её план на этот месяц и категория у мерчантов.'}
              {pastCount > 0 ? ` Прошлые месяцы (${pastCount} ${plural(pastCount, ['операция', 'операции', 'операций'])}) останутся в этой категории и не изменятся.` : ''}
            </Text>
          </View>
        ) : <><PushAccessBanner /><CardBalance /></>}
        {/* a dot on every mode whose filter is set: they all apply together */}
        <Segmented options={modeOptions} value={mode} onChange={setMode} style={styles.modes} disabled={deleting ? DELETE_MODE_DISABLED : undefined} />
        {!deleting && activeFilters.length > 0 ? (
          <View style={styles.activeRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChips} keyboardShouldPersistTaps="handled" style={styles.activeChips}>
              {activeFilters.map((f) => (
                <Chip key={f.key} label={`${f.label}  ✕`} selected onPress={f.clear} />
              ))}
            </ScrollView>
            {activeFilters.length > 1 ? (
              <TouchableOpacity onPress={resetFilters} hitSlop={10} accessibilityRole="button" accessibilityLabel="Сбросить все фильтры">
                <Text style={styles.clear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {mode === 'text' ? (
          <View style={styles.search}>
            <SearchIcon color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по тексту"
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
        ) : null}

        {mode === 'category' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChips} keyboardShouldPersistTaps="handled">
            {deleting && deletingCategory ? (
              // the category being deleted: its transactions of this month
              <Chip label={`${categoryLabel(deletingCategory)} · ${data.length}`} selected />
            ) : null}
            {categoryOptions.filter((c) => !deleting || c.category !== deleteCategoryId).map((c) => {
              const on = category === c.category;
              return (
                <Chip
                  key={String(c.category)}
                  label={`${categoryLabel(c)}${c.deleted ? ' (удалена)' : ''} · ${c.count}`}
                  selected={on}
                  muted={c.deleted || deleting}
                  disabled={deleting}
                  // tap the selected one again to clear
                  onPress={() => setCategory(on ? null : c.category)}
                />
              );
            })}
            {categoryOptions.length === 0 ? <Text style={styles.filterHint}>Операций пока нет</Text> : null}
          </ScrollView>
        ) : null}

        {mode === 'merchant' ? (
          <View style={styles.merchantBox}>
            <View style={styles.search}>
              <SearchIcon color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={merchantQuery}
                onChangeText={setMerchantQuery}
                placeholder="Найти мерчанта"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
              />
              {merchantQuery ? (
                <TouchableOpacity onPress={() => setMerchantQuery('')} hitSlop={10} accessibilityLabel="Очистить">
                  <Text style={styles.clear}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChips} keyboardShouldPersistTaps="handled">
              {shownMerchants.map((m) => {
                const on = merchant === m.merchant;
                return (
                  <Chip key={m.merchant} label={`${m.name} · ${m.count}`} selected={on} onPress={() => setMerchant(on ? null : m.merchant)} />
                );
              })}
              {shownMerchants.length === 0 ? <Text style={styles.filterHint}>{merchantQuery ? 'Не найдено' : 'Мерчантов пока нет'}</Text> : null}
            </ScrollView>
          </View>
        ) : null}

        {mode === 'date' ? (
          <View>
            <View style={styles.rangeRow}>
              <Text style={styles.rangeText}>{range ? formatRange(range) : 'Выберите день или период'}</Text>
              {range ? (
                <TouchableOpacity onPress={() => setRange(null)} hitSlop={10} accessibilityLabel="Сбросить даты">
                  <Text style={styles.clear}>✕</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setCalendarOpen((o) => !o)} hitSlop={10} style={styles.calendarToggle}>
                <Text style={styles.link}>{calendarOpen ? 'Скрыть календарь' : 'Календарь'}</Text>
              </TouchableOpacity>
            </View>
            {calendarOpen ? <RangeCalendar value={range} onChange={setRange} /> : null}
          </View>
        ) : null}

        {editMode ? (
          <View style={styles.toolbar}>
            {/* deleting a category: always selecting */}
            <TouchableOpacity style={styles.selectToggle} onPress={toggleSelectMode} disabled={deleting} accessibilityRole="checkbox" accessibilityState={{ checked: selectMode, disabled: deleting }}>
              <Checkbox checked={selectMode} size={20} />
              <Text style={styles.selectLabel}>Выбрать несколько</Text>
              {selectMode && selected.size > 0 ? <Text style={styles.selectCount}>({selected.size})</Text> : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectToggle} onPress={toggleSelectAll} accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }}>
              <Checkbox checked={allSelected} size={20} />
              <Text style={styles.selectLabel}>Выбрать все</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <SectionList
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
          const open = () => navigation.navigate('TransactionDetail', { txId: item.id });
          return (
            <TransactionItem
              tx={item}
              onPress={selectMode ? () => toggle(item.id) : open}
              selectable={selectMode}
              selected={selected.has(item.id)}
              onEdit={showRowActions ? open : undefined}
              onDelete={showRowActions ? () => confirmDeleteTransaction(item) : undefined}
            />
          );
        }}
        onEndReached={() => { loadMore().catch((e) => console.error('load more failed', e)); }}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={results ? undefined : onRefresh}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : <View style={[styles.footer, editMode && styles.footerTall]} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {deleting ? 'Операций не осталось.' : results ? 'Ничего не найдено.' : mode === 'date' && !range ? 'Выберите день или период в календаре.' : 'Операций пока нет. Они появятся здесь после SMS или уведомления банка, или добавьте вручную ＋.'}
          </Text>
        }
      />

      {selectMode && selected.size > 0 ? (
        <View style={[styles.bottomBar, styles.bottomBarStack]}>
          {/* the unread ones among the selected */}
          {!deleting && unreadSelected.length > 0 ? (
            <Button title={`Отметить просмотренными (${unreadSelected.length})`} onPress={readSelected} style={styles.secondaryButton} />
          ) : null}
          <Button title={`${deleting ? 'Перенести в категорию' : 'Изменить категорию'} (${selected.size})`} onPress={() => setBulkOpen(true)} />
        </View>
      ) : deleting && results !== null && data.length === 0 ? (
        <View style={styles.bottomBar}>
          <Button title="Удалить категорию" danger onPress={removeCategory} />
        </View>
      ) : null}
      {/* hidden in edit mode: it would cover the ✎ / 🗑 of the last row */}
      {editMode ? null : <Fab onPress={() => navigation.navigate('AddTransaction')} accessibilityLabel="Добавить операцию" />}

      <CategoryPickerModal
        visible={bulkOpen}
        title={`Выбрано операций: ${selected.size}`}
        // a category created from here is applied to the selection right away
        newCategory={{ txIds: [...selected], moveFromCategoryId: deleteCategoryId }}
        excludeIds={deleting ? [deleteCategoryId!] : undefined}
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
  modes: { marginBottom: 8 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  activeChips: { flexGrow: 0, flexShrink: 1 },
  catChips: { gap: 8, paddingVertical: 2 },
  filterHint: { fontSize: 14, color: colors.muted, paddingVertical: 8 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rangeText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  calendarToggle: { marginLeft: 'auto' },
  link: { fontSize: 14, color: colors.accent },
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
  selectCount: { fontSize: 13, color: colors.muted },
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
  merchantBox: { gap: 8 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.muted },
  daySpent: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  deleteInfo: { paddingBottom: 10, gap: 4 },
  deleteTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  deleteHint: { fontSize: 13, color: colors.muted },
});
