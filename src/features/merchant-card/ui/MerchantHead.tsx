import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { MerchantDetails } from '@/db/merchants';
import { plural } from '@/shared/lib/format';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import { money } from '../texts';

type Props = { m: MerchantDetails; mixed: boolean; saving: boolean; onShowTransactions: () => void; onSwitchMixed: (on: boolean) => void };

/** Like a category's page: how many operations and how much — a link to them (the name is the page's title); the "Разные категории" switch. */
export default function MerchantHead({ m, mixed, saving, onShowTransactions, onSwitchMixed }: Props) {
  return (
    <>
      {m.count > 0 ? (
        <TextLink
          label={`${m.count} ${plural(m.count, ['операция', 'операции', 'операций'])}${m.totals.length ? ` · ${money(m.totals)}` : ''}`}
          onPress={onShowTransactions} style={styles.summary} containerStyle={styles.summaryBox}
        />
      ) : <Text style={styles.meta}>Операций нет</Text>}

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
  summaryBox: { alignSelf: 'flex-start' },
  summary: { fontSize: 15 },
  meta: { fontSize: 15, color: colors.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  switchText: { flex: 1 },
  switchTitle: { fontSize: 16, color: colors.text },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
