import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HeaderBackButton } from '@react-navigation/elements';
import {
  categoriesWithTransactions, CategoryFilter, CategoryWithCount, deleteTransaction, isUnread, listTransactionsFiltered,
  listTransactionsPage, PageCursor, searchTransactions, TransactionRow,
} from '../db/transactions';
import { emitTransactionsChanged, onTransactionsChanged } from '../events';
import { categoryLabel } from '../db/categories';
import { assignCategoryToMany } from '../assign';
import { TabParamList, useRootNavigation } from '../navigation';
import CategoryPickerModal from './CategoryPickerModal';
import Checkbox from './Checkbox';
import { dayKey, formatAmount, formatDay, formatTime, isIncome } from './format';
import { PencilIcon, SearchIcon, TrashIcon } from './icons';
import RangeCalendar, { DayRange, formatRange, rangeToUnix } from './RangeCalendar';
import { colors } from './theme';

const PAGE_SIZE = 50;

type FilterMode = 'text' | 'category' | 'date';
const MODES: Array<[FilterMode, string]> = [['text', 'По тексту'], ['category', 'По категории'], ['date', 'По дате']];
type Filter = { mode: FilterMode; query: string; category: CategoryFilter | null; range: DayRange | null };

/** Only the filter of the selected mode applies. */
function isFilterActive(f: Filter): boolean {
  if (f.mode === 'text') return f.query.trim() !== '';
  if (f.mode === 'category') return f.category !== null;
  return f.range !== null;
}

async function runFilterQuery(f: Filter): Promise<TransactionRow[] | null> {
  if (!isFilterActive(f)) return null;
  if (f.mode === 'text') return searchTransactions(f.query);
  if (f.mode === 'category') return listTransactionsFiltered({ category: f.category! });
  return listTransactionsFiltered(rangeToUnix(f.range!));
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

  const [mode, setMode] = useState<FilterMode>('text');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter | null>(null);
  const [range, setRange] = useState<DayRange | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<CategoryWithCount[]>([]);
  const filter: Filter = { mode, query, category, range };
  const filterActive = isFilterActive(filter);
  // read by refreshAll without making it change (and re-run focus effects) on every keystroke
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const [results, setResults] = useState<TransactionRow[] | null>(null); // null = no filter, normal feed
  const searchId = useRef(0);

  // opened from the stats screen: filter by that category (or text)
  const route = useRoute<RouteProp<TabParamList, 'Transactions'>>();
  const { query: incomingQuery, category: incomingCategory, nonce, from } = route.params ?? {};
  useEffect(() => {
    if (incomingCategory !== undefined) { setMode('category'); setCategory(incomingCategory); }
    else if (incomingQuery !== undefined) { setMode('text'); setQuery(incomingQuery); }
  }, [incomingQuery, incomingCategory, nonce]);

  const [selectMode, setSelectMode] = useState(false);
  // shows edit / delete icons on every row; exclusive with selectMode
  const [editMode, setEditMode] = useState(false);
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
  }, [mode, category, range, runFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadedCount.current = 0; // pull-to-refresh goes back to the first page
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  const data = results ?? rows;

  // forget selected transactions that are no longer shown (deleted, filtered out)
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(data.map((r) => r.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  const sections = useMemo(() => {
    const out: Array<{ key: string; title: string; data: TransactionRow[] }> = [];
    for (const r of data) {
      const key = dayKey(r.occurred_at);
      if (out.length === 0 || out[out.length - 1].key !== key) {
        out.push({ key, title: formatDay(r.occurred_at), data: [] });
      }
      out[out.length - 1].data.push(r);
    }
    return out;
  }, [data]);

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
    setRange(null);
  }

  // came here from another screen (not the tab bar): back returns there with the filter cleared
  function goBack() {
    const target = from;
    tabNavigation.setParams({ from: undefined, category: undefined, query: undefined });
    resetFilters();
    if (target) tabNavigation.navigate(target);
  }

  // Android hardware back does the same as the header arrow
  useFocusEffect(useCallback(() => {
    if (!from) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]));

  // opening the tab from the tab bar is a normal visit: no back button
  useEffect(() => tabNavigation.addListener('tabPress', () => {
    if (from) tabNavigation.setParams({ from: undefined });
  }), [tabNavigation, from]);

  useLayoutEffect(() => {
    tabNavigation.setOptions({
      headerLeft: from
        ? () => <HeaderBackButton onPress={goBack} accessibilityLabel="Назад" />
        : undefined,
      headerRight: () => (
        <TouchableOpacity
          style={[styles.editToggle, editMode && styles.editToggleOn]}
          onPress={toggleEditMode}
          accessibilityRole="button"
          accessibilityState={{ selected: editMode }}
        >
          <PencilIcon color={editMode ? '#FFFFFF' : colors.accent} size={16} />
          <Text style={[styles.editToggleText, editMode && styles.editToggleTextOn]}>{editMode ? 'Готово' : 'Редактировать'}</Text>
        </TouchableOpacity>
      ),
    });
    // toggleEditMode / goBack only use state setters, navigation and `from`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabNavigation, editMode, from]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function confirmDelete(tx: TransactionRow) {
    Alert.alert('Удалить транзакцию?', `${tx.raw_merchant || 'Без мерчанта'}, ${formatAmount(tx.amount_minor, tx.currency, tx.kind)}`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          await deleteTransaction(tx.id);
          emitTransactionsChanged();
        },
      },
    ]);
  }

  async function applyBulk(categoryId: number | null) {
    setBulkOpen(false);
    try {
      await assignCategoryToMany([...selected], categoryId);
      setSelected(new Set());
      setSelectMode(false);
    } catch (e) {
      console.error('bulk assign failed', e);
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
        <View style={styles.modes}>
          {MODES.map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.mode, mode === key && styles.modeOn]} onPress={() => setMode(key)}>
              <Text style={[styles.modeText, mode === key && styles.modeTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'text' ? (
          <View style={styles.search}>
            <SearchIcon color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Поиск по SMS и категориям"
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
            {categoryOptions.map((c) => {
              const on = category === c.category;
              return (
                <TouchableOpacity
                  key={String(c.category)}
                  style={[styles.catChip, on && styles.catChipOn]}
                  // tap the selected one again to clear
                  onPress={() => setCategory(on ? null : c.category)}
                >
                  <Text style={[styles.catChipText, on && styles.catChipTextOn, c.deleted && !on && styles.catChipDeleted]}>
                    {categoryLabel(c)}{c.deleted ? ' (удалена)' : ''} · {c.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {categoryOptions.length === 0 ? <Text style={styles.filterHint}>Транзакций пока нет</Text> : null}
          </ScrollView>
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
            <TouchableOpacity style={styles.selectToggle} onPress={toggleSelectMode} accessibilityRole="checkbox" accessibilityState={{ checked: selectMode }}>
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
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => (selectMode ? toggle(item.id) : navigation.navigate('TransactionDetail', { txId: item.id }))}
            >
              {selectMode ? <View style={styles.checkbox}><Checkbox checked={isSelected} /></View> : null}
              <View style={styles.rowMain}>
                <View style={styles.titleRow}>
                  {isUnread(item) ? <View style={styles.unreadDot} accessibilityLabel="Не просмотрена" /> : null}
                  <Text style={[styles.merchant, isUnread(item) && styles.merchantUnread]} numberOfLines={1}>
                    {item.raw_merchant || 'Без мерчанта'}
                  </Text>
                </View>
                {item.category_id ? (
                  <Text style={styles.category} numberOfLines={1}>
                    {categoryLabel({ emoji: item.category_emoji, name: item.category_name!, type_name: item.category_type_name })} · {formatTime(item.occurred_at)}
                  </Text>
                ) : (
                  <View style={styles.inline}>
                    <Text style={styles.badge}>Без категории</Text>
                    <Text style={styles.category}> · {formatTime(item.occurred_at)}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.amount, isIncome(item.kind) && styles.income]}>
                {formatAmount(item.amount_minor, item.currency, item.kind)}
              </Text>
              {showRowActions ? (
                <>
                  <TouchableOpacity
                    style={styles.rowAction}
                    hitSlop={6}
                    onPress={() => navigation.navigate('TransactionDetail', { txId: item.id })}
                    accessibilityLabel="Редактировать"
                  >
                    <PencilIcon color={colors.muted} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rowAction} hitSlop={6} onPress={() => confirmDelete(item)} accessibilityLabel="Удалить">
                    <TrashIcon color={colors.danger} size={18} />
                  </TouchableOpacity>
                </>
              ) : null}
            </TouchableOpacity>
          );
        }}
        onEndReached={() => { loadMore().catch((e) => console.error('load more failed', e)); }}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={results ? undefined : onRefresh}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : <View style={styles.footer} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {results ? 'Ничего не найдено.' : mode === 'date' && !range ? 'Выберите день или период в календаре.' : 'Транзакций пока нет. Они появятся здесь после SMS от банка.'}
          </Text>
        }
      />

      {selectMode ? (
        selected.size > 0 ? (
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.bulkButton} onPress={() => setBulkOpen(true)}>
              <Text style={styles.bulkText}>Изменить категорию ({selected.size})</Text>
            </TouchableOpacity>
          </View>
        ) : null
      ) : filterActive || editMode ? null : (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddTransaction')}
          accessibilityLabel="Добавить транзакцию"
        >
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      )}

      <CategoryPickerModal
        visible={bulkOpen}
        title={`Выбрано транзакций: ${selected.size}`}
        // a category created from here is applied to the selection right away
        newCategory={{ txIds: [...selected] }}
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
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, backgroundColor: colors.bg },
  modes: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, padding: 2, marginBottom: 8 },
  mode: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  modeOn: { backgroundColor: colors.bg },
  modeText: { fontSize: 13, color: colors.muted },
  modeTextOn: { color: colors.text, fontWeight: '600' },
  catChips: { gap: 8, paddingVertical: 2 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface },
  catChipOn: { backgroundColor: colors.accent },
  catChipText: { fontSize: 14, color: colors.text },
  catChipTextOn: { color: '#FFFFFF' },
  catChipDeleted: { color: colors.muted },
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
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, marginRight: 16,
    borderRadius: 16, borderWidth: 1, borderColor: colors.accent,
  },
  editToggleOn: { backgroundColor: colors.accent },
  editToggleText: { fontSize: 14, color: colors.accent },
  editToggleTextOn: { color: '#FFFFFF' },
  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.surface,
    color: colors.muted, fontSize: 13, fontWeight: '600',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowSelected: { backgroundColor: '#EFF6FF' },
  checkbox: { marginRight: 12 },
  rowMain: { flex: 1, marginRight: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 8 },
  merchant: { flexShrink: 1, fontSize: 16, color: colors.text },
  merchantUnread: { fontWeight: '600' },
  category: { fontSize: 13, color: colors.muted, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  badge: {
    fontSize: 12, color: colors.warn, backgroundColor: colors.warnBg,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
  },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  income: { color: colors.income },
  rowAction: { padding: 6, marginLeft: 6 },
  footer: { paddingVertical: 16, marginBottom: 72 },
  fab: {
    position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  fabText: { color: '#FFFFFF', fontSize: 28, lineHeight: 32 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  bulkButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  bulkText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
});
