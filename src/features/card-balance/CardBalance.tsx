import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { cardBalance, CardBalance as Balance } from '@/db/balance';
import { onTransactionsChanged } from '@/events';
import { formatDay, formatTime, plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { colors } from '@/shared/theme/theme';

/** "Баланс карты 283.14 ₾" as the bank last reported it, plus the operations after that (a deposit has no balance). */
export default function CardBalance() {
  // undefined = loading, null = no SMS with a balance yet
  const [balance, setBalance] = useState<Balance | null | undefined>(undefined);
  const load = useCallback(() => {
    cardBalance().then(setBalance).catch((e) => console.error('load card balance failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (balance === undefined) return null;
  if (balance === null) {
    return (
      <View style={styles.box}>
        <View style={styles.text}>
          <Text style={styles.label}>Баланс карты</Text>
          <Text style={styles.note}>Появится после следующего SMS от банка с балансом (например, о покупке)</Text>
        </View>
        <Text style={[styles.amount, styles.unknown]}>—</Text>
      </View>
    );
  }
  const when = `${formatDay(balance.asOf).toLowerCase()} ${formatTime(balance.asOf)}`;
  const note = balance.pending
    ? `≈ по SMS ${when} + ${balance.pending} ${plural(balance.pending, ['операция', 'операции', 'операций'])} после`
    : `по SMS ${when}`;
  return (
    <TouchableOpacity
      style={styles.box}
      onPress={() => sheetAlert('Баланс карты', balance.pending
        ? 'Баланс из последнего SMS банка плюс операции после него: в SMS о пополнении баланса нет. Следующее SMS с балансом (например, о покупке) уточнит его.'
        : 'Баланс, который банк прислал в последнем SMS.')}
      accessibilityLabel={`Баланс карты ${formatMoneyWithCurrency(balance.minor, balance.currency)}, ${note}`}
    >
      <View style={styles.text}>
        <Text style={styles.label}>Баланс карты</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <Text style={styles.amount}>{balance.pending ? '≈ ' : ''}{formatMoneyWithCurrency(balance.minor, balance.currency)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  text: { flex: 1, marginRight: 12 },
  label: { fontSize: 13, color: colors.muted },
  unknown: { color: colors.muted },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
});
