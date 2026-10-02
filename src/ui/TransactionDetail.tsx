import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getTransaction } from '../db/transactions';
import { Category, isTransferCategory, listCategories } from '../db/categories';
import { assignCategory } from '../assign';
import type { RootStackParamList } from '../navigation';
import { formatAmount, formatDay, formatTime, isIncome } from './format';
import CategoryPicker from './CategoryPicker';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;
type Tx = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

export default function TransactionDetail({ route, navigation }: Props) {
  const { txId } = route.params;
  const [tx, setTx] = useState<Tx | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [applyToMerchant, setApplyToMerchant] = useState(true);
  const [saving, setSaving] = useState(false);

  // on focus: also picks up a category just created on the CreateCategory screen
  useFocusEffect(useCallback(() => {
    Promise.all([getTransaction(txId), listCategories(200)])
      .then(([t, cats]) => { setTx(t ?? null); setCategories(cats); })
      .catch((e) => console.error('load transaction failed', e));
  }, [txId]));

  async function choose(categoryId: number | null) {
    if (saving) return;
    setSaving(true);
    try {
      await assignCategory(txId, categoryId, { applyToMerchant: applyToMerchant && !!tx?.merchant_key });
      navigation.goBack();
    } catch (e) {
      console.error('assign category failed', e);
      setSaving(false);
    }
  }

  if (!tx) return <View style={styles.center}><ActivityIndicator /></View>;

  // transfers: "Перевод…" categories first
  const orderedCategories = tx.kind === 'transfer'
    ? [...categories.filter(isTransferCategory), ...categories.filter((c) => !isTransferCategory(c))]
    : categories;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
        {formatAmount(tx.amount_minor, tx.currency, tx.kind)}
      </Text>
      <Text style={styles.merchant}>{tx.raw_merchant || 'Без мерчанта'}</Text>
      <Text style={styles.meta}>{formatDay(tx.occurred_at)}, {formatTime(tx.occurred_at)}</Text>

      <Text style={styles.heading}>Категория</Text>
      <CategoryPicker
        categories={orderedCategories}
        selectedId={tx.category_id}
        onSelect={choose}
        disabled={saving}
        txId={txId}
      />

      {tx.merchant_key ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Запомнить для «{tx.raw_merchant || tx.merchant_key}» и применить к его транзакциям</Text>
          <Switch value={applyToMerchant} onValueChange={setApplyToMerchant} />
        </View>
      ) : null}

      {tx.category_id ? (
        <TouchableOpacity style={styles.clear} disabled={saving} onPress={() => choose(null)}>
          <Text style={styles.clearText}>Убрать категорию</Text>
        </TouchableOpacity>
      ) : null}

      {tx.raw_sms ? (
        <>
          <Text style={styles.heading}>SMS</Text>
          <Text style={styles.sms} selectable>{tx.raw_sms}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  amount: { fontSize: 28, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  income: { color: colors.income },
  merchant: { fontSize: 18, color: colors.text, marginTop: 4 },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 24, marginBottom: 8, textTransform: 'uppercase' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  switchLabel: { flex: 1, fontSize: 14, color: colors.text, marginRight: 12 },
  clear: { marginTop: 16, alignSelf: 'flex-start' },
  clearText: { fontSize: 15, color: colors.warn },
  sms: { fontSize: 13, color: colors.muted, backgroundColor: colors.surface, padding: 12, borderRadius: 8 },
});
