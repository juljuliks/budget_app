import React, { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { txCategoryLabel } from '@/db/categories';
import { isUnread, TransactionRow } from '@/db/transactions';
import Checkbox from '@/shared/ui/Checkbox';
import { formatAmount, formatTime, isIncome } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { rowTitle } from '../model/title';
import { splitRow } from '../model/parts';
import { SplitIcon } from '@/shared/ui/icons';
import RowActions from '@/shared/ui/RowActions';
import { colors } from '@/shared/theme/theme';
import { NO_CATEGORY } from '@/shared/lib/strings';

/** The handlers get the row's operation: the list passes the same functions to every row, so a row redraws only when its own props change. */
type Props = {
  tx: TransactionRow;
  /** a tap: opens the operation, or while selecting toggles it */
  onPress: (tx: TransactionRow) => void;
  /** a long press: starts selecting several, with this one selected */
  onLongPress?: (tx: TransactionRow) => void;
  /** multi-select: checkbox in front */
  selectable?: boolean;
  selected?: boolean;
  /** edit mode: 🗑 at the end */
  onDelete?: (tx: TransactionRow) => void;
};

/** One row of the transactions list: merchant (bold + blue dot when unread), category · time, amount. */
export default React.memo(TransactionItem);

function TransactionItem({ tx, onPress, onLongPress, selectable, selected, onDelete }: Props) {
  // Android delivers a press when the finger lifts after a long press too: that one would unselect the row
  const longPressed = useRef(false);
  const unread = isUnread(tx);
  // new and categorized by a merchant rule, not by the user: worth a glance
  const auto = tx.seen_at === null && tx.category_source === 'rule';
  const category = txCategoryLabel(tx);
  // split: its categories; in a list of some categories, its parts in them
  const split = splitRow(tx);
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={() => { if (longPressed.current) longPressed.current = false; else onPress(tx); }}
      onLongPress={onLongPress ? () => { longPressed.current = true; onLongPress(tx); } : undefined}
      onPressIn={() => { longPressed.current = false; }}
    >
      {selectable ? <View style={styles.checkbox}><Checkbox checked={!!selected} /></View> : null}
      <View style={styles.main}>
        <View style={styles.titleRow}>
          {unread ? <View style={styles.unreadDot} accessibilityLabel="Новая" /> : null}
          <Text style={[styles.merchant, unread && styles.merchantUnread]} numberOfLines={1}>{rowTitle(tx)}</Text>
          {auto ? <Text style={styles.auto} accessibilityLabel="Категория мерчанта, назначена автоматически">🤖 авто</Text> : null}
        </View>
        {tx.refund_settled_at ? (
          // a refund settled on its purchase earlier: it no longer counts by itself
          <Text style={styles.meta} numberOfLines={1}>✓ учтён в покупке · {formatTime(tx.occurred_at)}</Text>
        ) : split ? (
          <View style={styles.inline}>
            <SplitIcon color={colors.muted} size={13} />
            <Text style={[styles.meta, styles.splitMeta]} numberOfLines={1}>{split.label}</Text>
            <Text style={[styles.meta, styles.splitTime]}> · {formatTime(tx.occurred_at)}</Text>
          </View>
        ) : category ? (
          <Text style={styles.meta} numberOfLines={1}>{category} · {formatTime(tx.occurred_at)}</Text>
        ) : (
          <View style={styles.inline}>
            <Text style={styles.badge}>{NO_CATEGORY}</Text>
            <Text style={styles.meta}> · {formatTime(tx.occurred_at)}</Text>
          </View>
        )}
      </View>
      <View style={styles.amountBox}>
        <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
          {formatAmount(split?.amount_minor ?? tx.amount_minor, tx.currency, tx.kind)}
        </Text>
        {split?.part ? <Text style={styles.whole}>из {formatMoneyWithCurrency(tx.amount_minor, tx.currency)}</Text> : null}
      </View>
      {onDelete ? <RowActions onDelete={() => onDelete(tx)} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowSelected: { backgroundColor: '#EFF6FF' },
  checkbox: { marginRight: 12 },
  main: { flex: 1, marginRight: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 8 },
  merchant: { flexShrink: 1, fontSize: 16, color: colors.text },
  merchantUnread: { fontWeight: '600' },
  auto: {
    marginLeft: 8, fontSize: 11, color: colors.accent, backgroundColor: '#EFF6FF',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
  },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  badge: {
    fontSize: 12, color: colors.warn, backgroundColor: colors.warnBg,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
  },
  splitMeta: { flexShrink: 1, marginTop: 0, marginLeft: 4 },
  splitTime: { flexShrink: 0, marginTop: 0 },
  amountBox: { alignItems: 'flex-end' },
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  whole: { fontSize: 12, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  income: { color: colors.income },
});
