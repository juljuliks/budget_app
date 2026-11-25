import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
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
import { space } from '@/shared/theme/tokens';
import Empty from '@/shared/ui/Empty';

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
  loadMore: () => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
  loadingMore: boolean;
  /** room for the bottom bar (selecting) */
  tallFooter: boolean;
  emptyText: string;
  /** «＋» hides while scrolling down */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

/** The operations by sections (days or groups), a page at a time while scrolling, pull to refresh. */
export default function OperationsList(p: Props) {
  const { onPressRow, onLongPressRow, selecting, selected } = p;
  // several banks read: each row says whose it is
  const { several } = useBanks();
  // the rows are memoized: a selection or a page loaded redraws only the rows whose props changed
  const renderItem = useCallback(
    ({ item }: { item: Row }) => (
      <TransactionItem
        tx={item}
        bankLabel={several && item.bank !== 'manual' ? bankById(item.bank)?.short : undefined}
        onPress={onPressRow}
        onLongPress={onLongPressRow}
        selectable={selecting}
        selected={selected.has(item.id)}
      />
    ),
    [onPressRow, onLongPressRow, selecting, selected, several],
  );
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
      onScroll={p.onScroll}
      scrollEventThrottle={100}
      onEndReached={() => {
        p.loadMore().catch(toastFailure('load more', LOAD_FAILED));
      }}
      // the next page is read a screen before the end; rows are drawn a batch at a time, the ones far off-screen dropped
      onEndReachedThreshold={1}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={11}
      refreshing={p.refreshing}
      onRefresh={p.onRefresh}
      ListFooterComponent={
        p.loadingMore ? (
          <ActivityIndicator style={styles.footer} />
        ) : (
          <View style={[styles.footer, p.tallFooter && styles.footerTall]} />
        )
      }
      ListEmptyComponent={<Empty>{p.emptyText}</Empty>}
    />
  );
}

/** room under the list for the floating «＋», and for the bottom bar's two buttons while selecting */
const FAB_ROOM = 72;
const BAR_ROOM = 130;

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  footer: { paddingVertical: space[16], marginBottom: FAB_ROOM },
  // edit mode: room for two buttons in the bottom bar
  footerTall: { marginBottom: BAR_ROOM },
});
