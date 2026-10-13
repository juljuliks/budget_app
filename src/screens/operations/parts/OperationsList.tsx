import React, { useCallback } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import type { TransactionRow } from '@/db/transactions';
import { bankById } from '@/domain/banks';
import { TransactionItem } from '@/entities/transaction';
import { useBanks } from '@/features/banks';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { colors } from '@/shared/theme/theme';
import { toastFailure } from '@/shared/ui/toast';
import type { Row, Section } from '../model/listData';
import SectionHeader from './SectionHeader';

type Props = {
  /** a new filter remounts the list */
  listKey: string;
  sections: Section[];
  selecting: boolean;
  selected: Set<number>;
  groupIds: Map<string, number[]>;
  daySpent: Map<string, number>;
  currency: Currency;
  onToggleGroup: (section: Section) => void;
  onOpenDay: (dayStart: number) => void;
  /** the row handlers: the same functions every render (useStableCallback), or every row redraws */
  onPressRow: (row: TransactionRow) => void;
  onLongPressRow?: (row: TransactionRow) => void;
  /** edit mode: 🗑 on every row */
  onDeleteRow?: (row: TransactionRow) => void;
  loadMore: () => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
  loadingMore: boolean;
  /** room for the bottom bar (edit mode, selecting) */
  tallFooter: boolean;
  emptyText: string;
};

/** The operations by sections (days or groups), a page at a time while scrolling, pull to refresh. */
export default function OperationsList(p: Props) {
  const { onPressRow, onLongPressRow, onDeleteRow, selecting, selected } = p;
  // several banks read: each row says whose it is
  const { several } = useBanks();
  // the rows are memoized: a selection or a page loaded redraws only the rows whose props changed
  const renderItem = useCallback(({ item }: { item: Row }) => (
    <TransactionItem
      tx={item}
      bankLabel={several && item.bank !== 'manual' ? bankById(item.bank)?.short : undefined}
      onPress={onPressRow}
      onLongPress={onLongPressRow}
      selectable={selecting}
      selected={selected.has(item.id)}
      onDelete={onDeleteRow}
    />
  ), [onPressRow, onLongPressRow, onDeleteRow, selecting, selected, several]);
  return (
    <SectionList
      // a new filter remounts the list: Android sticky headers keep their old offsets when the sections
      // change under a scrolled list and cover the rows ("Вчера" over operations)
      key={p.listKey}
      testID="operations-list"
      style={styles.list}
      sections={p.sections}
      // by category a split operation is in several groups
      keyExtractor={(i) => (i.group_key ? `${i.id}:${i.group_key}` : String(i.id))}
      stickySectionHeadersEnabled
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({ section }) => (
        <SectionHeader
          section={section}
          selecting={p.selecting}
          ids={p.groupIds.get(section.key)}
          selected={p.selected}
          spent={p.daySpent.get(section.key) ?? 0}
          currency={p.currency}
          onToggle={() => p.onToggleGroup(section)}
          onOpenDay={() => p.onOpenDay(section.dayStart)}
        />
      )}
      renderItem={renderItem}
      onEndReached={() => { p.loadMore().catch(toastFailure('load more', LOAD_FAILED)); }}
      // the next page is read a screen before the end; rows are drawn a batch at a time, the ones far off-screen dropped
      onEndReachedThreshold={1}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={11}
      refreshing={p.refreshing}
      onRefresh={p.onRefresh}
      ListFooterComponent={p.loadingMore ? <ActivityIndicator style={styles.footer} /> : <View style={[styles.footer, p.tallFooter && styles.footerTall]} />}
      ListEmptyComponent={<Text style={styles.empty}>{p.emptyText}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  footer: { paddingVertical: 16, marginBottom: 72 },
  // edit mode: room for two buttons in the bottom bar
  footerTall: { marginBottom: 130 },
  empty: { padding: 32, textAlign: 'center', color: colors.muted },
});
