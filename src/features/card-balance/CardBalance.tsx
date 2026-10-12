import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { cardBalance, CardBalance as Balance } from '@/db/balance';
import { enabledBanks } from '@/db/banks';
import { bankById, BankId } from '@/domain/banks';
import { onTransactionsChanged } from '@/domain/events';
import { formatDay, formatTime, plural } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { colors } from '@/shared/theme/theme';

type Card = { bank: BankId; balance: Balance | null };

/** "по SMS вчера 12:00", with the operations after it: "≈ по SMS вчера 12:00 + 3 операции после". */
function noteOf(b: Balance): string {
  const when = `${formatDay(b.asOf).toLowerCase()} ${formatTime(b.asOf)}`;
  return b.pending ? `≈ по SMS ${when} + ${b.pending} ${plural(b.pending, ['операция', 'операции', 'операций'])} после` : `по SMS ${when}`;
}
const amountOf = (b: Balance) => `${b.pending ? '≈ ' : ''}${formatMoneyWithCurrency(b.minor, b.currency)}`;
const explain = (b: Balance) => sheetAlert('Баланс карты', b.pending
  ? 'Баланс из последнего SMS банка плюс операции после него: в SMS о пополнении баланса нет. Следующее SMS с балансом (например, о покупке) уточнит его.'
  : 'Баланс, который банк прислал в последнем SMS.');

/**
 * "Баланс карты 283.14 ₾" as the bank last reported it, plus the operations after that (a deposit has no balance). Several
 * banks read: "Балансы карт", a line for each.
 */
export default function CardBalance() {
  // undefined = loading
  const [cards, setCards] = useState<Card[] | undefined>(undefined);
  const load = useCallback(() => {
    (async () => {
      const ids = await enabledBanks();
      setCards(await Promise.all(ids.map(async (bank) => ({ bank, balance: await cardBalance(bank) }))));
    })().catch((e) => console.error('load card balance failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (!cards?.length) return null;
  if (cards.length > 1) {
    return (
      <View style={[styles.box, styles.column]}>
        <Text style={styles.label}>Балансы карт</Text>
        {cards.map(({ bank, balance }) => {
          const b = bankById(bank)!;
          return (
            <TouchableOpacity key={bank} style={styles.line} disabled={!balance} onPress={() => balance && explain(balance)}
              accessibilityLabel={`${b.name}: ${balance ? `${formatMoneyWithCurrency(balance.minor, balance.currency)}, ${noteOf(balance)}` : 'баланса пока нет'}`}>
              <View style={[styles.badge, { backgroundColor: b.color }]}><Text style={styles.badgeText}>{b.short}</Text></View>
              <Text style={[styles.note, styles.lineNote]} numberOfLines={1}>{balance ? noteOf(balance) : 'после SMS с балансом'}</Text>
              <Text style={[styles.lineAmount, !balance && styles.unknown]}>{balance ? amountOf(balance) : '—'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
  const { balance } = cards[0];
  if (!balance) {
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
  return (
    <TouchableOpacity style={styles.box} onPress={() => explain(balance)}
      accessibilityLabel={`Баланс карты ${formatMoneyWithCurrency(balance.minor, balance.currency)}, ${noteOf(balance)}`}>
      <View style={styles.text}>
        <Text style={styles.label}>Баланс карты</Text>
        <Text style={styles.note}>{noteOf(balance)}</Text>
      </View>
      <Text style={styles.amount}>{amountOf(balance)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  text: { flex: 1, marginRight: 12 },
  label: { fontSize: 13, color: colors.muted },
  unknown: { color: colors.muted },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  lineNote: { flex: 1, marginTop: 0 },
  lineAmount: { fontSize: 17, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.onAccent },
});
