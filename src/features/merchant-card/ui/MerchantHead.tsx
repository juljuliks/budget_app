import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import type { MerchantDetails } from '@/db/merchants';
import { plural } from '@/shared/lib/format';
import { colors } from '@/shared/theme/theme';
import { money } from '../texts';

type Props = { m: MerchantDetails; mixed: boolean; saving: boolean; onShowTransactions: () => void; onSwitchMixed: (on: boolean) => void };

/** The name; like a category's sheet: how many operations and how much, a link to them; the "Разные категории" switch. */
export default function MerchantHead({ m, mixed, saving, onShowTransactions, onSwitchMixed }: Props) {
  return (
    <>
      <Text style={styles.title}>{m.name}</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.meta} numberOfLines={1}>
          {m.count} {plural(m.count, ['операция', 'операции', 'операций'])}
          {m.totals.length ? ` · ${money(m.totals)}` : ''}
        </Text>
        {m.count > 0 ? (
          <TouchableOpacity onPress={onShowTransactions} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>Показать операции ›</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* a delivery of groceries or meals: no category of its own, each new operation asks */}
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchTitle}>Разные категории</Text>
          <Text style={styles.switchHint}>Каждая новая операция спрашивает категорию</Text>
        </View>
        <Switch value={mixed} onValueChange={onSwitchMixed} disabled={saving} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.bg} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600', color: colors.text, flexShrink: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  meta: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  link: { fontSize: 14, color: colors.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  switchText: { flex: 1 },
  switchTitle: { fontSize: 16, color: colors.text },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
