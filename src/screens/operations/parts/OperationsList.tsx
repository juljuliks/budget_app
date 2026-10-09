import React from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { TransactionItem } from '@/entities/transaction';
import { colors } from '@/shared/theme/theme';
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
  onPressRow: (id: number) => void;
  onLongPressRow?: (id: number) => void;
  /** edit mode: 🗑 on every row */
  onDeleteRow?: (row: Row) => void;
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
  return (
    <SectionList
      // a new filter remounts the list: Android sticky headers keep their old offsets when the sections
      // change under a scrolled list and cover the rows ("Вчера" over operations)
      key={p.listKey}
      testID="operations-list"
      style={styles.list}
      sections={p.sections}
      keyExtractor={(i) => String(i.id)}
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
      renderItem={({ item }) => (
        <TransactionItem
          tx={item}
          onPress={() => p.onPressRow(item.id)}
          onLongPress={p.onLongPressRow ? () => p.onLongPressRow!(item.id) : undefined}
          selectable={p.selecting}
          selected={p.selected.has(item.id)}
          onDelete={p.onDeleteRow ? () => p.onDeleteRow!(item) : undefined}
        />
      )}
      onEndReached={() => { p.loadMore().catch((e) => console.error('load more failed', e)); }}
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
