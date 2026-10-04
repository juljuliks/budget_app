import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sheetAlert } from './sheetAlert';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import notifee from '@notifee/react-native';
import {
  deletePurchaseByRefund, getRefund, reducePurchaseByRefund, Refund, REFUND_LOOKBACK_DAYS, RefundCandidate, refundCandidates,
} from '../db/refunds';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import { formatDay } from './format';
import { MinusCircleIcon, TrashIcon } from './icons';
import { formatWithCurrency } from './money';
import { ROW_ICON_SIZE } from './RowActions';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RefundResolve'>;

/**
 * A shop refunded money: pick the purchase it belongs to and reduce it by the refunded amount, or delete it
 * when everything came back. The month's spending then shows what was really paid.
 */
export default function RefundResolve({ route, navigation }: Props) {
  const { refundId } = route.params;
  const [refund, setRefund] = useState<Refund | null>(null);
  const [candidates, setCandidates] = useState<RefundCandidate[] | null>(null);

  useFocusEffect(useCallback(() => {
    Promise.all([getRefund(refundId), refundCandidates(refundId)])
      .then(([r, c]) => { setRefund(r ?? null); setCandidates(c); })
      .catch((e) => console.error('load refund failed', e));
  }, [refundId]));

  if (!refund || !candidates) return <View style={styles.center}><ActivityIndicator /></View>;

  const money = (minor: number) => formatWithCurrency(minor, refund.currency);
  const shop = refund.raw_merchant || 'мерчант';

  async function settled(action: Promise<void>) {
    try {
      await action;
      // the "Возврат" notification has done its job
      await notifee.cancelNotification(`tx_${refundId}`).catch(() => {});
      emitTransactionsChanged();
      navigation.goBack();
    } catch (e) {
      console.error('settle refund failed', e);
    }
  }

  function reduce(p: RefundCandidate) {
    if (p.amount_minor <= refund!.amount_minor) {
      sheetAlert('Вернули всю сумму', `Возврат ${money(refund!.amount_minor)} покрывает покупку целиком — удалите её.`);
      return;
    }
    sheetAlert(
      'Уменьшить сумму покупки?',
      `${shop}, ${formatDay(p.occurred_at).toLowerCase()}\n${money(p.amount_minor)} → ${money(p.amount_minor - refund!.amount_minor)}\n\n`
        + 'В тратах останется только то, что вы в итоге заплатили.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: `Вычесть ${money(refund!.amount_minor)}`, onPress: () => settled(reducePurchaseByRefund(refundId, p.id)) },
      ]);
  }

  function remove(p: RefundCandidate) {
    sheetAlert(
      'Удалить покупку?',
      `${shop}, ${formatDay(p.occurred_at).toLowerCase()}, ${money(p.amount_minor)}.\nДеньги вернули — покупка пропадёт из операций и статистики.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => settled(deletePurchaseByRefund(refundId, p.id)) },
      ]);
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={refund.refund_settled_at ? [] : candidates}
      keyExtractor={(c) => String(c.id)}
      ListHeaderComponent={
        <View>
          <Text style={styles.amount}>+{money(refund.amount_minor)}</Text>
          <Text style={styles.meta}>Возврат от {shop} · {formatDay(refund.occurred_at)}</Text>
          {refund.refund_settled_at ? (
            <Text style={styles.done}>✓ Возврат учтён в покупке</Text>
          ) : (
            <>
              <Text style={styles.hint}>
                За какую покупку вернули деньги? Уменьшите её сумму на возврат (−) или удалите её (🗑), если вернули всё.
              </Text>
              <Text style={styles.heading}>Покупки в {shop} за {REFUND_LOOKBACK_DAYS} дней</Text>
            </>
          )}
        </View>
      }
      ListEmptyComponent={refund.refund_settled_at ? null : (
        <Text style={styles.hint}>Покупок в {shop} не нашлось. Возврат останется в операциях и не повлияет на траты.</Text>
      )}
      renderItem={({ item: p }) => (
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.rowAmount}>{money(p.amount_minor)}</Text>
            <View style={styles.rowMetaLine}>
              <Text style={styles.rowMeta}>{formatDay(p.occurred_at)}</Text>
              {p.same_amount ? <Text style={styles.same}>та же сумма</Text> : null}
            </View>
          </View>
          <TouchableOpacity style={styles.action} hitSlop={6} onPress={() => reduce(p)} accessibilityLabel="Уменьшить сумму на возврат">
            <MinusCircleIcon color={colors.accent} size={ROW_ICON_SIZE + 4} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} hitSlop={6} onPress={() => remove(p)} accessibilityLabel="Удалить покупку">
            <TrashIcon color={colors.danger} size={ROW_ICON_SIZE + 4} />
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  amount: { fontSize: 28, fontWeight: '600', color: colors.income, fontVariant: ['tabular-nums'] },
  meta: { fontSize: 15, color: colors.muted, marginTop: 4 },
  hint: { fontSize: 14, color: colors.muted, marginTop: 16, lineHeight: 20 },
  done: { fontSize: 15, color: colors.income, marginTop: 16, fontWeight: '600' },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 24, marginBottom: 4, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowMain: { flex: 1 },
  rowAmount: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  rowMeta: { fontSize: 13, color: colors.muted },
  same: {
    fontSize: 12, color: colors.accent, backgroundColor: '#EFF6FF',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden',
  },
  action: { padding: 8, marginLeft: 4 },
});
