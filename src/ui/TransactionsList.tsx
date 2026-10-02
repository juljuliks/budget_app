import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  deleteTransaction, listTransactionsPage, PageCursor, searchTransactions, TransactionRow,
} from '../db/transactions';
import { emitTransactionsChanged, onTransactionsChanged } from '../events';
import { categoryLabel } from '../db/categories';
import { assignCategoryToMany } from '../assign';
import { useRootNavigation } from '../navigation';
import CategoryPickerModal from './CategoryPickerModal';
import Checkbox from './Checkbox';
import { dayKey, formatAmount, formatDay, formatTime, isIncome } from './format';
import { PencilIcon, SearchIcon, TrashIcon } from './icons';
import { colors } from './theme';

const PAGE_SIZE = 50;
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
  // read by refreshAll without making it change (and re-run focus effects) on every keystroke
  const queryRef = useRef('');
  queryRef.current = query;
  const [results, setResults] = useState<TransactionRow[] | null>(null); // null = not searching
  const searchId = useRef(0);

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

  const runSearch = useCallback(async (q: string) => {
    const id = ++searchId.current;
    if (!q.trim()) { setResults(null); return; }
    const found = await searchTransactions(q);
    if (id === searchId.current) setResults(found);
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
    runSearch(queryRef.current).catch((e) => console.error('search failed', e));
  }, [reload, runSearch]);

  useFocusEffect(refreshAll);
  useEffect(() => onTransactionsChanged(refreshAll), [refreshAll]);

  useEffect(() => {
    const t = setTimeout(() => { runSearch(query).catch((e) => console.error('search failed', e)); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, runSearch]);

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

  function toggleSelectMode() {
    setSelectMode((on) => !on);
    setEditMode(false);
    setSelected(new Set());
  }

  function toggleEditMode() {
    setEditMode((on) => !on);
    setSelectMode(false);
    setSelected(new Set());
  }

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
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.selectToggle} onPress={toggleSelectMode} accessibilityRole="checkbox" accessibilityState={{ checked: selectMode }}>
            <Checkbox checked={selectMode} size={20} />
            <Text style={styles.selectLabel}>Выбрать несколько</Text>
            {selectMode && selected.size > 0 ? <Text style={styles.selectCount}>({selected.size})</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editToggle, editMode && styles.editToggleOn]}
            onPress={toggleEditMode}
            accessibilityRole="button"
            accessibilityState={{ selected: editMode }}
          >
            <PencilIcon color={editMode ? '#FFFFFF' : colors.accent} size={16} />
            <Text style={[styles.editToggleText, editMode && styles.editToggleTextOn]}>{editMode ? 'Готово' : 'Редактировать'}</Text>
          </TouchableOpacity>
        </View>
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
                <Text style={styles.merchant} numberOfLines={1}>{item.raw_merchant || 'Без мерчанта'}</Text>
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
            {results ? 'Ничего не найдено.' : 'Транзакций пока нет. Они появятся здесь после SMS от банка.'}
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
      ) : (
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
        transferOnly={selectedRows.length > 0 && selectedRows.every((r) => r.kind === 'transfer')}
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
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderRadius: 10, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 },
  clear: { fontSize: 16, color: colors.muted },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  selectToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  selectLabel: { fontSize: 15, color: colors.text },
  selectCount: { fontSize: 13, color: colors.muted },
  editToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
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
  merchant: { fontSize: 16, color: colors.text },
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
