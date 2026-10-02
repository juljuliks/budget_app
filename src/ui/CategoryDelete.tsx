import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Category, categoryLabel, countPastTransactionsOfCategory, currentTransactionsOfCategory, deleteCategory, getCategory,
} from '../db/categories';
import { emitTransactionsChanged } from '../events';
import type { RootStackParamList } from '../navigation';
import CategoryPicker from './CategoryPicker';
import { formatAmount, formatDay } from './format';
import { colors } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryDelete'>;
type Tx = Awaited<ReturnType<typeof currentTransactionsOfCategory>>[number];

/**
 * Deleting a category: this month's transactions move to the chosen category;
 * past months keep the deleted one so history doesn't change.
 */
export default function CategoryDelete({ route, navigation }: Props) {
  const { categoryId, selectCategoryId } = route.params;
  const [category, setCategory] = useState<Category | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [pastCount, setPastCount] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getCategory(categoryId),
      currentTransactionsOfCategory(categoryId),
      countPastTransactionsOfCategory(categoryId),
    ]).then(([c, current, past]) => {
      setCategory(c ?? null);
      setTxs(current);
      setPastCount(past);
    }).catch((e) => console.error('load category delete failed', e));
  }, [categoryId]);

  // a category just created via "+ Новая категория" comes back selected
  useEffect(() => {
    if (selectCategoryId !== undefined) setTarget(selectCategoryId);
  }, [selectCategoryId]);

  async function confirm() {
    setSaving(true);
    try {
      await deleteCategory(categoryId, target);
      emitTransactionsChanged();
      navigation.goBack();
    } catch (e) {
      console.error('delete category failed', e);
      setSaving(false);
    }
  }

  if (!category || !txs) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Удалить «{categoryLabel(category)}»?</Text>

      {txs.length > 0 ? (
        <>
          <Text style={styles.heading}>Транзакции этого месяца ({txs.length})</Text>
          {txs.map((t) => (
            <View key={t.id} style={styles.txRow}>
              <Text style={styles.txName} numberOfLines={1}>{t.raw_merchant || 'Без мерчанта'}</Text>
              <Text style={styles.txMeta}>{formatDay(t.occurred_at)}</Text>
              <Text style={styles.txAmount}>{formatAmount(t.amount_minor, t.currency, t.kind)}</Text>
            </View>
          ))}

          <CategoryPicker
            title="Перенести их в категорию"
            // already in category management: no gear here
            showSettings={false}
            newCategory={{ returnSelection: true }}
            selectedId={target}
            onSelect={setTarget}
            allowNone
            excludeIds={[categoryId]}
            // only when everything being moved is a money transfer (a purchase may sit in a transfer category)
            transferOnly={txs.every((t) => t.kind === 'transfer')}
          />
        </>
      ) : (
        <Text style={styles.hint}>В этом месяце транзакций в этой категории нет.</Text>
      )}

      {pastCount > 0 ? (
        <Text style={styles.hint}>
          {pastCount} транзакц. за прошлые месяцы останутся в «{category.name}» — история и статистика прошлых месяцев не изменятся.
        </Text>
      ) : null}
      <Text style={styles.hint}>Правила для мерчантов перейдут в выбранную категорию, пункт плана текущего месяца будет удалён.</Text>

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={confirm}>
        <Text style={styles.buttonText}>
          {txs.length > 0 && target !== null ? 'Перенести и удалить' : 'Удалить'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '600', color: colors.text },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  txName: { flex: 1, fontSize: 15, color: colors.text, marginRight: 8 },
  txMeta: { fontSize: 13, color: colors.muted, marginRight: 8 },
  txAmount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  hint: { color: colors.muted, marginTop: 12, fontSize: 13 },
  button: { marginTop: 24, backgroundColor: colors.danger, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
