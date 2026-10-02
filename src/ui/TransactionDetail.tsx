import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { deleteTransaction, getTransaction } from '../db/transactions';
import { Category, listCategories } from '../db/categories';
import { getTransferTypeId } from '../db/categoryTypes';
import { assignCategory } from '../assign';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import { formatAmount, formatDay, formatTime, isIncome } from './format';
import CategoryPicker from './CategoryPicker';
import SectionHeading from './SectionHeading';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;
type Tx = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

export default function TransactionDetail({ route, navigation }: Props) {
  const { txId } = route.params;
  const [tx, setTx] = useState<Tx | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transferTypeId, setTransferTypeId] = useState<number | null>(null);
  const [applyToMerchant, setApplyToMerchant] = useState(true);
  const [saving, setSaving] = useState(false);

  // on focus: also picks up categories created / edited on the category screens
  useFocusEffect(useCallback(() => {
    (async () => {
      const t = await getTransaction(txId);
      // money transfers: only categories of the transfer type
      const [cats, transferType] = await Promise.all([listCategories({ transferOnly: t?.kind === 'transfer' }), getTransferTypeId()]);
      setTx(t ?? null);
      setCategories(cats);
      setTransferTypeId(transferType);
    })().catch((e) => console.error('load transaction failed', e));
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

  function confirmDelete() {
    Alert.alert('Удалить транзакцию?', 'Она пропадёт из истории и статистики.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          await deleteTransaction(txId);
          emitTransactionsChanged();
          navigation.goBack();
        },
      },
    ]);
  }

  if (!tx) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
        {formatAmount(tx.amount_minor, tx.currency, tx.kind)}
      </Text>
      <Text style={styles.merchant}>{tx.raw_merchant || 'Без мерчанта'}</Text>
      <Text style={styles.meta}>{formatDay(tx.occurred_at)}, {formatTime(tx.occurred_at)}</Text>

      <SectionHeading title="Категория" onSettings={() => navigation.navigate('Categories')} settingsLabel="Управление категориями" />
      <CategoryPicker
        categories={categories}
        selectedId={tx.category_id}
        onSelect={choose}
        disabled={saving}
        txId={txId}
        newCategoryTypeId={tx.kind === 'transfer' ? transferTypeId : null}
      />
      {tx.kind === 'transfer' && categories.length === 0 ? (
        <Text style={styles.hint}>Для переводов нужна категория с типом «Переводы» — создайте её.</Text>
      ) : null}

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

      <TouchableOpacity style={styles.delete} disabled={saving} onPress={confirmDelete}>
        <Text style={styles.deleteText}>Удалить транзакцию</Text>
      </TouchableOpacity>
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
  hint: { fontSize: 13, color: colors.muted, marginTop: 8 },
  delete: { marginTop: 32, alignSelf: 'flex-start' },
  deleteText: { fontSize: 15, color: colors.danger },
  sms: { fontSize: 13, color: colors.muted, backgroundColor: colors.surface, padding: 12, borderRadius: 8 },
});
