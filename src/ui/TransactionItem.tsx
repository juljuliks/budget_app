import React, { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { txCategoryLabel } from '../db/categories';
import { isUnread, TransactionRow } from '../db/transactions';
import Checkbox from '@/shared/ui/Checkbox';
import { formatAmount, formatTime, isIncome, merchantLabel } from '@/shared/lib/format';
import RowActions from '@/shared/ui/RowActions';
import { colors } from '@/shared/theme/theme';
import { NO_CATEGORY } from '@/shared/lib/strings';

type Props = {
  tx: TransactionRow;
  /** a tap: opens the operation, or while selecting toggles it */
  onPress: () => void;
  /** a long press: starts selecting several, with this one selected */
  onLongPress?: () => void;
  /** multi-select: checkbox in front */
  selectable?: boolean;
  selected?: boolean;
  /** edit mode: 🗑 at the end */
  onDelete?: () => void;
};

/** One row of the transactions list: merchant (bold + blue dot when unread), category · time, amount. */
export default function TransactionItem({ tx, onPress, onLongPress, selectable, selected, onDelete }: Props) {
  // Android delivers a press when the finger lifts after a long press too: that one would unselect the row
  const longPressed = useRef(false);
  const unread = isUnread(tx);
  // new and categorized by a merchant rule, not by the user: worth a glance
  const auto = tx.seen_at === null && tx.category_source === 'rule';
  const category = txCategoryLabel(tx);
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={() => { if (longPressed.current) longPressed.current = false; else onPress(); }}
      onLongPress={onLongPress ? () => { longPressed.current = true; onLongPress(); } : undefined}
      onPressIn={() => { longPressed.current = false; }}
    >
      {selectable ? <View style={styles.checkbox}><Checkbox checked={!!selected} /></View> : null}
      <View style={styles.main}>
        <View style={styles.titleRow}>
          {unread ? <View style={styles.unreadDot} accessibilityLabel="Новая" /> : null}
          <Text style={[styles.merchant, unread && styles.merchantUnread]} numberOfLines={1}>{merchantLabel(tx)}</Text>
          {auto ? <Text style={styles.auto} accessibilityLabel="Категория мерчанта, назначена автоматически">🤖 авто</Text> : null}
        </View>
        {tx.refund_settled_at ? (
          // a refund settled on its purchase earlier: it no longer counts by itself
          <Text style={styles.meta} numberOfLines={1}>✓ учтён в покупке · {formatTime(tx.occurred_at)}</Text>
        ) : category ? (
          <Text style={styles.meta} numberOfLines={1}>{category} · {formatTime(tx.occurred_at)}</Text>
        ) : (
          <View style={styles.inline}>
            <Text style={styles.badge}>{NO_CATEGORY}</Text>
            <Text style={styles.meta}> · {formatTime(tx.occurred_at)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
        {formatAmount(tx.amount_minor, tx.currency, tx.kind)}
      </Text>
      {onDelete ? <RowActions onDelete={onDelete} /> : null}
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
  amount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  income: { color: colors.income },
});
