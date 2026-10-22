import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { MerchantDetails } from '@/db/merchants';
import { plural } from '@/shared/lib/format';
import TextLink from '@/shared/ui/TextLink';
import { colors } from '@/shared/theme/theme';
import { money } from '../texts';

type Props = { m: MerchantDetails; onShowTransactions: () => void };

/** Like a category's page: how many operations and how much — a link to them (the name is the page's title). */
export default function MerchantHead({ m, onShowTransactions }: Props) {
  return m.count > 0 ? (
    <TextLink
      label={`${m.count} ${plural(m.count, ['операция', 'операции', 'операций'])}${m.totals.length ? ` · ${money(m.totals)}` : ''}`}
      onPress={onShowTransactions} style={styles.summary} containerStyle={styles.summaryBox}
    />
  ) : <Text style={styles.meta}>Операций нет</Text>;
}

const styles = StyleSheet.create({
  summaryBox: { alignSelf: 'flex-start' },
  summary: { fontSize: 15 },
  meta: { fontSize: 15, color: colors.muted },
});
