import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { deleteTransaction, getTransaction } from '../db/transactions';
import { assignCategory } from '../assign';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import { formatAmount, formatDay, formatTime, isIncome } from './format';
import CategoryPicker from './CategoryPicker';
import CategoryPickerModal from './CategoryPickerModal';
import SectionHeading from './SectionHeading';
import { categoryLabel } from '../db/categories';
import { TrashIcon } from './icons';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;
type Tx = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

export default function TransactionDetail({ route, navigation }: Props) {
  const { txId } = route.params;
  const [tx, setTx] = useState<Tx | null>(null);
  const [applyToMerchant, setApplyToMerchant] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // on focus: the category may have been changed on the category screens
  useFocusEffect(useCallback(() => {
    getTransaction(txId).then((t) => setTx(t ?? null)).catch((e) => console.error('load transaction failed', e));
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

  // delete is also in the header, so it's reachable without scrolling to the bottom
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={confirmDelete} hitSlop={12} accessibilityLabel="Удалить транзакцию">
          <TrashIcon color={colors.danger} />
        </TouchableOpacity>
      ),
    });
    // confirmDelete only depends on txId and navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, txId]);

  if (!tx) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.amount, isIncome(tx.kind) && styles.income]}>
        {formatAmount(tx.amount_minor, tx.currency, tx.kind)}
      </Text>
      <Text style={styles.merchant}>{tx.raw_merchant || 'Без мерчанта'}</Text>
      <Text style={styles.meta}>{formatDay(tx.occurred_at)}, {formatTime(tx.occurred_at)}</Text>

      {tx.category_id ? (
        // categorized: show the category and "Сменить категорию" (the picker opens in a sheet)
        <>
          <SectionHeading title="Категория" onSettings={() => navigation.navigate('Categories')} settingsLabel="Управление категориями" />
          <View style={styles.currentRow}>
            <View style={styles.currentChip}>
              <Text style={styles.currentText}>
                {categoryLabel({ emoji: tx.category_emoji, name: tx.category_name!, type_name: tx.category_type_name })}
              </Text>
            </View>
            <TouchableOpacity style={styles.changeButton} disabled={saving} onPress={() => setPickerOpen(true)}>
              <Text style={styles.changeText}>Сменить категорию</Text>
            </TouchableOpacity>
          </View>
          <CategoryPickerModal
            visible={pickerOpen}
            title="Сменить категорию"
            selectedId={tx.category_id}
            transferOnly={tx.kind === 'transfer'}
            newCategory={{ txId }}
            allowNone
            onPick={(id) => { setPickerOpen(false); choose(id); }}
            onClose={() => setPickerOpen(false)}
          />
        </>
      ) : (
        <CategoryPicker
          selectedId={tx.category_id}
          onSelect={choose}
          allowNone
          // money transfers: only categories of the transfer type
          transferOnly={tx.kind === 'transfer'}
          newCategory={{ txId }}
          disabled={saving}
        />
      )}

      {tx.merchant_key ? (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Запомнить для «{tx.raw_merchant || tx.merchant_key}» и применить к его транзакциям</Text>
          <Switch value={applyToMerchant} onValueChange={setApplyToMerchant} />
        </View>
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
  currentRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  currentChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.accent },
  currentText: { fontSize: 15, color: '#FFFFFF' },
  changeButton: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  changeText: { fontSize: 15, color: colors.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  switchLabel: { flex: 1, fontSize: 14, color: colors.text, marginRight: 12 },
  delete: { marginTop: 32, alignSelf: 'flex-start' },
  deleteText: { fontSize: 15, color: colors.danger },
  sms: { fontSize: 13, color: colors.muted, backgroundColor: colors.surface, padding: 12, borderRadius: 8 },
});
