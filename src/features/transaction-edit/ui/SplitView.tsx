import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PartView, SPLIT_COLORS } from '@/entities/transaction';
import { plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { PencilIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import SplitBar from './SplitBar';

type Props = {
  /** every part, the operation's own category first */
  parts: PartView[];
  total: number;
  currency: string;
  onEdit: () => void;
};

/** A split operation's categories in its card: the bar, each part's share and amount; "Изменить" opens the split. */
export default function SplitView({ parts, total, currency, onEdit }: Props) {
  return (
    <>
      <View style={styles.head}>
        <Text style={styles.title}>Разделена · {parts.length} {plural(parts.length, ['категория', 'категории', 'категорий'])}</Text>
        <TouchableOpacity style={styles.edit} onPress={onEdit} hitSlop={8} accessibilityLabel="Изменить разделение">
          <PencilIcon color={colors.accent} size={16} />
          <Text style={styles.editText}>Изменить</Text>
        </TouchableOpacity>
      </View>
      <SplitBar total={total} amounts={parts.map((p) => p.amount_minor)} />
      {parts.map((p, i) => (
        <View key={p.category_id} style={[styles.row, i < parts.length - 1 && styles.divider]}>
          <View style={[styles.dot, { backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length] }]} />
          <Text style={styles.name} numberOfLines={1}>{p.label}</Text>
          <Text style={styles.share}>{Math.round((p.amount_minor / total) * 100)}%</Text>
          <Text style={styles.amount}>{formatMoneyWithCurrency(p.amount_minor, currency)}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editText: { fontSize: 15, color: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  share: { fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
  amount: { minWidth: 84, textAlign: 'right', fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
});
