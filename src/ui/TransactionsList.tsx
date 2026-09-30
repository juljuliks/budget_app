import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listTransactionsPage, PageCursor, TransactionRow } from '../db/transactions';
import { onTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import { dayKey, formatAmount, formatDay, formatTime, isIncome } from './format';
import { colors } from './theme';

const PAGE_SIZE = 50;

type Props = NativeStackScreenProps<RootStackParamList, 'Transactions'>;

export default function TransactionsList({ navigation }: Props) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [cursor, setCursor] = useState<PageCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Drops results of requests superseded by a newer reload
  const requestId = useRef(0);
  const loadedCount = useRef(0);

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

  const loadMore = useCallback(async () => {
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
  }, [cursor, loadingMore, loading]);

  useFocusEffect(useCallback(() => {
    reload().catch((e) => console.error('load transactions failed', e));
  }, [reload]));

  useEffect(() => onTransactionsChanged(() => {
    reload().catch((e) => console.error('reload transactions failed', e));
  }), [reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadedCount.current = 0; // pull-to-refresh goes back to the first page
    try { await reload(); } finally { setRefreshing(false); }
  }, [reload]);

  const sections = useMemo(() => {
    const out: Array<{ key: string; title: string; data: TransactionRow[] }> = [];
    for (const r of rows) {
      const key = dayKey(r.occurred_at);
      if (out.length === 0 || out[out.length - 1].key !== key) {
        out.push({ key, title: formatDay(r.occurred_at), data: [] });
      }
      out[out.length - 1].data.push(r);
    }
    return out;
  }, [rows]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(i) => String(i.id)}
      stickySectionHeadersEnabled
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('TransactionDetail', { txId: item.id })}>
          <View style={styles.rowMain}>
            <Text style={styles.merchant} numberOfLines={1}>{item.raw_merchant || 'Без мерчанта'}</Text>
            {item.category_id ? (
              <Text style={styles.category} numberOfLines={1}>
                {`${item.category_emoji || ''} ${item.category_name}`.trim()} · {formatTime(item.occurred_at)}
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
        </TouchableOpacity>
      )}
      onEndReached={() => { loadMore().catch((e) => console.error('load more failed', e)); }}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} /> : null}
      ListEmptyComponent={
        <Text style={styles.empty}>Транзакций пока нет. Они появятся здесь после SMS от банка.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.surface,
    color: colors.muted, fontSize: 13, fontWeight: '600',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
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
  footer: { paddingVertical: 16 },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
});
